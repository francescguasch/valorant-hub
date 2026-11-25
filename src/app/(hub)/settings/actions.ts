"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actorOf, getViewer, isOwner, isStaff, type Member } from "@/lib/auth/viewer";
import { friendlyDbError, withActor } from "@/lib/db";
import { codeHint, generateCode, hashCode } from "@/lib/auth/codes";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { fieldErrors, type FormState } from "@/lib/forms";
import { PUBLICABLE_SECTIONS } from "@/lib/sections";

const denied: FormState = { error: "You don't have permission to do that.", fields: {} };

async function staff(): Promise<Member | null> {
  const v = await getViewer();
  return isStaff(v) ? v : null;
}
async function owner(): Promise<Member | null> {
  const v = await getViewer();
  return isOwner(v) ? v : null;
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #FF4655.");
const imageUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || v.startsWith("/brand/") || /^https?:\/\//.test(v), "Upload an image or use a full https:// link.");
const TIMEZONES = new Set(Intl.supportedValuesOf("timeZone"));

// -----------------------------------------------------------------------------
// Team & branding (staff)
// -----------------------------------------------------------------------------
const brandingSchema = z.object({
  university_name: z.string().trim().min(2, "Enter the university name.").max(80),
  team_name: z.string().trim().min(2, "Enter the team name.").max(60),
  hero_kicker: z.string().trim().max(80),
  hero_tagline: z.string().trim().max(80),
  season_label: z.string().trim().min(1, "Enter the season.").max(30),
  accent_color: hex,
  secondary_color: hex,
  timezone: z.string().refine((tz) => TIMEZONES.has(tz), "Pick a timezone from the list."),
  logo_url: imageUrl,
  hero_image_url: imageUrl.refine((v) => v !== "", "The home page needs a campus photo."),
});

export async function updateBranding(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await staff();
  if (!me) return denied;
  const parsed = brandingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields.", fields: fieldErrors(parsed.error) };
  const v = parsed.data;
  try {
    await withActor(actorOf(me), (tx) => tx`
      update public.team_settings set
        university_name = ${v.university_name}, team_name = ${v.team_name}, hero_kicker = ${v.hero_kicker},
        hero_tagline = ${v.hero_tagline}, season_label = ${v.season_label}, accent_color = ${v.accent_color.toUpperCase()},
        secondary_color = ${v.secondary_color.toUpperCase()}, timezone = ${v.timezone},
        logo_url = ${v.logo_url || null}, hero_image_url = ${v.hero_image_url}
      where id`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/", "layout");
  return { error: null, fields: {}, success: "Team details saved." };
}

// -----------------------------------------------------------------------------
// Visitor access (owner)
// -----------------------------------------------------------------------------
export async function updateAccess(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await owner();
  if (!me) return denied;
  const enabled = formData.get("public_view_enabled") === "on";
  const sections = formData.getAll("sections").map(String).filter((s) => (PUBLICABLE_SECTIONS as string[]).includes(s));
  try {
    await withActor(actorOf(me), (tx) => tx`
      update public.team_settings set public_view_enabled = ${enabled}, public_sections = ${sections} where id`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/", "layout");
  return {
    error: null,
    fields: {},
    success: enabled ? "Saved. Visitors with the link can view the sections you selected." : "Saved. The hub is now private to members.",
  };
}

// -----------------------------------------------------------------------------
// Invitations (owner: any role; coach: players only — also enforced by RLS)
// -----------------------------------------------------------------------------
const inviteSchema = z.object({
  role: z.enum(["owner", "coach", "player"]),
  player_id: z.string().uuid().or(z.literal("")),
  email: z.string().trim().toLowerCase().email("Enter a valid email or leave it empty.").or(z.literal("")),
  note: z.string().trim().max(80),
  days: z.coerce.number().int().min(1).max(30),
});

export async function createInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await staff();
  if (!me) return denied;
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields.", fields: fieldErrors(parsed.error) };
  const v = parsed.data;
  if (v.role !== "player" && me.role !== "owner") {
    return { error: "Only the team owner can invite coaches or owners.", fields: {} };
  }
  if (v.role === "player" && v.player_id) {
    const [taken] = await withActor(actorOf(me), (tx) => tx<{ nickname: string }[]>`
      select p.nickname from public.profiles pr join public.players p on p.id = pr.player_id where pr.player_id = ${v.player_id}`);
    if (taken) {
      return {
        error: `${taken.nickname} already has an account. If they can't sign in, create a password reset code for them instead.`,
        fields: {},
      };
    }
  }
  const code = generateCode();
  try {
    await withActor(actorOf(me), (tx) => tx`
      insert into public.invitations (code_hash, code_hint, role, player_id, email, note, created_by, expires_at)
      values (${hashCode(code)}, ${codeHint(code)}, ${v.role}, ${v.role === "player" && v.player_id ? v.player_id : null},
              ${v.email || null}, ${v.note || null}, ${me.userId}, now() + make_interval(days => ${v.days}))`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/settings/members");
  return { error: null, fields: {}, success: "Invitation created. Copy the code now: it won't be shown again.", reveal: code };
}

export async function revokeInvitation(formData: FormData) {
  const me = await staff();
  if (!me) return;
  const id = z.string().uuid().parse(formData.get("id"));
  await withActor(actorOf(me), (tx) => tx`update public.invitations set revoked_at = now() where id = ${id} and used_at is null`);
  revalidatePath("/settings/members");
}

// -----------------------------------------------------------------------------
// Members (owner)
// -----------------------------------------------------------------------------
const memberSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["owner", "coach", "player"]),
  player_id: z.string().uuid().or(z.literal("")),
});

export async function updateMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await owner();
  if (!me) return denied;
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "That change isn't valid.", fields: {} };
  const v = parsed.data;
  try {
    await withActor(actorOf(me), async (tx) => {
      if (v.player_id) await tx`update public.profiles set player_id = null where player_id = ${v.player_id} and id <> ${v.id}`;
      await tx`update public.profiles set role = ${v.role}, player_id = ${v.player_id || null} where id = ${v.id}`;
    });
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/settings/members");
  return { error: null, fields: {}, success: "Member updated." };
}

export async function setMemberAccess(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await owner();
  if (!me) return denied;
  const id = z.string().uuid().parse(formData.get("id"));
  const disable = formData.get("disable") === "true";
  if (id === me.userId && disable) return { error: "You can't block your own account.", fields: {} };
  try {
    await withActor(actorOf(me), (tx) => tx`update public.profiles set disabled = ${disable} where id = ${id}`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  const admin = createSupabaseAdmin();
  await admin.auth.admin.updateUserById(id, { ban_duration: disable ? "876000h" : "none" });
  revalidatePath("/settings/members");
  return { error: null, fields: {}, success: disable ? "Access blocked. They are signed out." : "Access restored." };
}

export async function removeMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await owner();
  if (!me) return denied;
  const id = z.string().uuid().parse(formData.get("id"));
  if (id === me.userId) return { error: "You can't remove your own account.", fields: {} };
  const [target] = await withActor(actorOf(me), (tx) => tx<{ role: string; disabled: boolean }[]>`
    select role, disabled from public.profiles where id = ${id}`);
  if (!target) return { error: "That member no longer exists.", fields: {} };
  const admin = createSupabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: error.message, fields: {} };
  revalidatePath("/settings/members");
  return { error: null, fields: {}, success: "Member removed." };
}

export async function createResetCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await staff();
  if (!me) return denied;
  const id = z.string().uuid().parse(formData.get("id"));
  const code = generateCode();
  try {
    await withActor(actorOf(me), (tx) => tx`
      insert into public.reset_codes (user_id, code_hash, created_by, expires_at)
      values (${id}, ${hashCode(code)}, ${me.userId}, now() + interval '24 hours')`);
  } catch (e) {
    const msg = friendlyDbError(e);
    return { error: msg === "You don't have permission to do that." ? "Coaches can create reset codes for players only." : msg, fields: {} };
  }
  return { error: null, fields: {}, success: "Reset code created. It works once, for 24 hours.", reveal: code };
}

// -----------------------------------------------------------------------------
// Demo data (owner)
// -----------------------------------------------------------------------------
export async function setDemoData(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await owner();
  if (!me) return denied;
  const load = formData.get("mode") === "load";
  try {
    await withActor(actorOf(me), (tx) => (load ? tx`select app.load_demo_data()` : tx`select app.clear_demo_data()`));
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/", "layout");
  return { error: null, fields: {}, success: load ? "Demo data loaded." : "Demo data removed. Your real records were not touched." };
}

// -----------------------------------------------------------------------------
// Your account (everyone)
// -----------------------------------------------------------------------------
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const v = await getViewer();
  if (v.kind !== "member") return denied;
  const parsed = z
    .object({ display_name: z.string().trim().min(2, "Enter at least 2 characters.").max(40) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: null, fields: fieldErrors(parsed.error) };
  await withActor(actorOf(v), (tx) => tx`update public.profiles set display_name = ${parsed.data.display_name} where id = ${v.userId}`);
  revalidatePath("/", "layout");
  return { error: null, fields: {}, success: "Name updated." };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const v = await getViewer();
  if (v.kind !== "member") return denied;
  const parsed = z
    .object({
      current: z.string().min(1, "Enter your current password."),
      password: z.string().min(8, "Use at least 8 characters.").max(72),
      confirm: z.string(),
    })
    .refine((x) => x.password === x.confirm, { path: ["confirm"], message: "The passwords don't match." })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: null, fields: fieldErrors(parsed.error) };
  const supabase = await createSupabaseServer();
  const check = await supabase.auth.signInWithPassword({ email: v.email, password: parsed.data.current });
  if (check.error) return { error: null, fields: { current: "That isn't your current password." } };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message, fields: {} };
  return { error: null, fields: {}, success: "Password changed." };
}
