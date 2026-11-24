"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { asSystem } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { hashCode, normalizeCode } from "@/lib/auth/codes";
import { safeNext } from "@/lib/auth/viewer";
import type { FormState } from "@/lib/forms";
import { fieldErrors } from "@/lib/forms";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z.string().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer.");
const displayName = z.string().trim().min(2, "Enter at least 2 characters.").max(40, "Use 40 characters or fewer.");

async function signInWith(emailValue: string, passwordValue: string) {
  const supabase = await createSupabaseServer();
  return supabase.auth.signInWithPassword({ email: emailValue, password: passwordValue });
}

// -----------------------------------------------------------------------------
// Sign in
// -----------------------------------------------------------------------------
export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Enter your password.") })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: null, fields: fieldErrors(parsed.error) };

  const { data, error } = await signInWith(parsed.data.email, parsed.data.password);
  if (error || !data.user) return { error: "Email or password is incorrect.", fields: {} };

  const [profile] = await asSystem((tx) => tx<{ disabled: boolean }[]>`
    select disabled from public.profiles where id = ${data.user.id}`);
  if (!profile || profile.disabled) {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
    return { error: "This account doesn't have access to the team hub. Ask the team owner.", fields: {} };
  }
  await asSystem((tx) => tx`update public.profiles set last_seen_at = now() where id = ${data.user.id}`);
  redirect(safeNext(String(formData.get("next") ?? "/")));
}

// -----------------------------------------------------------------------------
// Create an account with an invitation code
// -----------------------------------------------------------------------------
const joinSchema = z
  .object({ code: z.string().trim().min(1, "Enter your invitation code."), email, displayName, password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." });

type Invitation = { id: string; role: "owner" | "coach" | "player"; player_id: string | null; email: string | null };

export async function joinWithInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = joinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: null, fields: fieldErrors(parsed.error) };
  const v = parsed.data;

  const [invite] = await asSystem((tx) => tx<Invitation[]>`
    select id, role, player_id, email from public.invitations
    where code_hash = ${hashCode(v.code)} and used_at is null and revoked_at is null and expires_at > now()`);
  if (!invite || normalizeCode(v.code).length !== 12) {
    return { error: "That invitation code isn't valid. It may have expired or already been used.", fields: {} };
  }
  if (invite.email && invite.email.toLowerCase() !== v.email) {
    return { error: null, fields: { email: "This invitation was issued for a different email address." } };
  }

  const admin = createSupabaseAdmin();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { display_name: v.displayName },
  });
  if (createError || !created.user) {
    const exists = createError?.code === "email_exists" || /already/i.test(createError?.message ?? "");
    return exists
      ? { error: null, fields: { email: "An account with this email already exists. Sign in instead." } }
      : { error: createError?.message ?? "The account couldn't be created. Try again.", fields: {} };
  }

  try {
    await asSystem(async (tx) => {
      const claimed = await tx`
        update public.invitations set used_at = now()
        where id = ${invite.id} and used_at is null and revoked_at is null returning id`;
      if (claimed.length === 0) throw new Error("invitation-already-used");
      // A player slot can belong to only one account.
      const playerId = invite.player_id
        ? (await tx`select 1 from public.profiles where player_id = ${invite.player_id}`).length === 0
          ? invite.player_id
          : null
        : null;
      await tx`insert into public.profiles (id, email, display_name, role, player_id, last_seen_at)
               values (${created.user.id}, ${v.email}, ${v.displayName}, ${invite.role}, ${playerId}, now())`;
      await tx`update public.invitations set used_by = ${created.user.id} where id = ${invite.id}`;
    });
  } catch (e) {
    await admin.auth.admin.deleteUser(created.user.id);
    if ((e as Error).message === "invitation-already-used") {
      return { error: "That invitation code has just been used. Ask for a new one.", fields: {} };
    }
    throw e;
  }

  await signInWith(v.email, v.password);
  redirect("/");
}

// -----------------------------------------------------------------------------
// Reset a password with a code issued by the owner or a coach
// -----------------------------------------------------------------------------
const resetSchema = z
  .object({ email, code: z.string().trim().min(1, "Enter the reset code."), password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." });

export async function resetWithCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: null, fields: fieldErrors(parsed.error) };
  const v = parsed.data;

  const [row] = await asSystem((tx) => tx<{ id: string; user_id: string }[]>`
    select r.id, r.user_id from public.reset_codes r
    join public.profiles p on p.id = r.user_id
    where r.code_hash = ${hashCode(v.code)} and r.used_at is null and r.expires_at > now()
      and lower(p.email) = ${v.email} and not p.disabled`);
  if (!row) return { error: "That email and reset code don't match, or the code has expired.", fields: {} };

  const admin = createSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(row.user_id, { password: v.password });
  if (error) return { error: error.message, fields: {} };
  await asSystem((tx) => tx`update public.reset_codes set used_at = now() where user_id = ${row.user_id} and used_at is null`);

  redirect("/login?reset=1");
}

// -----------------------------------------------------------------------------
// First-time setup: create the team owner (only while no owner exists)
// -----------------------------------------------------------------------------
const setupSchema = z
  .object({ token: z.string().min(1, "Enter the setup key."), email, displayName, password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match." });

export async function hasOwner(): Promise<boolean> {
  const rows = await asSystem((tx) => tx`select 1 from public.profiles where role = 'owner' limit 1`);
  return rows.length > 0;
}

export async function setupOwner(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = setupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: null, fields: fieldErrors(parsed.error) };
  const v = parsed.data;

  const expected = serverEnv.setupToken();
  if (!expected || expected.length < 16) {
    return { error: "Setup is locked. Add a SETUP_TOKEN of at least 16 characters to the environment variables first.", fields: {} };
  }
  const a = Buffer.from(v.token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: null, fields: { token: "That setup key is not correct." } };
  if (await hasOwner()) return { error: "This team already has an owner. Sign in instead.", fields: {} };

  const admin = createSupabaseAdmin();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { display_name: v.displayName },
  });
  if (error || !created.user) return { error: error?.message ?? "The account couldn't be created.", fields: {} };

  try {
    await asSystem(async (tx) => {
      await tx`select pg_advisory_xact_lock(4242)`;
      const owners = await tx`select 1 from public.profiles where role = 'owner'`;
      if (owners.length > 0) throw new Error("owner-exists");
      await tx`insert into public.profiles (id, email, display_name, role, last_seen_at)
               values (${created.user.id}, ${v.email}, ${v.displayName}, 'owner', now())`;
    });
  } catch (e) {
    await admin.auth.admin.deleteUser(created.user.id);
    if ((e as Error).message === "owner-exists") return { error: "This team already has an owner. Sign in instead.", fields: {} };
    throw e;
  }

  await signInWith(v.email, v.password);
  redirect("/");
}
