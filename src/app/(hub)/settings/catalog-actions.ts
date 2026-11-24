"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actorOf } from "@/lib/auth/viewer";
import { DENIED, staffOrNull, text } from "@/lib/auth/guards";
import { friendlyDbError, withActor } from "@/lib/db";
import type { FormState } from "@/lib/forms";

const uuidOrEmpty = z.string().uuid().or(z.literal(""));
const imageUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\//.test(v), "Use a full https:// link or leave it empty.");

function done(path: string, message: string): FormState {
  revalidatePath(path);
  revalidatePath("/", "layout");
  return { error: null, fields: {}, success: message };
}

// ----------------------------------------------------------------------------- Maps
export async function saveMap(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const v = z
    .object({ id: uuidOrEmpty, name: z.string().trim().min(2, "Enter the map name.").max(40), image_url: imageUrl })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return { error: v.error.issues[0]!.message, fields: {} };
  const inRotation = fd.get("in_rotation") === "on";
  const active = fd.get("active") === "on";
  try {
    await withActor(actorOf(me), (tx) =>
      v.data.id
        ? tx`update public.maps set name = ${v.data.name}, in_rotation = ${inRotation}, active = ${active},
               image_url = ${text(v.data.image_url)} where id = ${v.data.id}`
        : tx`insert into public.maps (name, in_rotation, active, image_url, sort_order)
             values (${v.data.name}, ${inRotation}, true, ${text(v.data.image_url)},
                     (select coalesce(max(sort_order), 0) + 1 from public.maps))`,
    );
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  return done("/settings/maps", v.data.id ? `${v.data.name} saved.` : `${v.data.name} added.`);
}

export async function setRotation(fd: FormData) {
  const me = await staffOrNull();
  if (!me) return;
  const id = z.string().uuid().parse(fd.get("id"));
  const on = fd.get("on") === "true";
  await withActor(actorOf(me), (tx) => tx`update public.maps set in_rotation = ${on} where id = ${id}`);
  revalidatePath("/settings/maps");
  revalidatePath("/playbook");
}

export async function deleteMap(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = z.string().uuid().parse(fd.get("id"));
  try {
    await withActor(actorOf(me), (tx) => tx`delete from public.maps where id = ${id}`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  return done("/settings/maps", "Map deleted.");
}

// ----------------------------------------------------------------------------- Agents
export async function saveAgent(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const v = z
    .object({
      id: uuidOrEmpty,
      name: z.string().trim().min(2, "Enter the agent name.").max(30),
      role: z.enum(["duelist", "initiator", "controller", "sentinel"]),
      image_url: imageUrl,
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return { error: v.error.issues[0]!.message, fields: {} };
  const active = fd.get("active") === "on";
  try {
    await withActor(actorOf(me), (tx) =>
      v.data.id
        ? tx`update public.agents set name = ${v.data.name}, role = ${v.data.role}, active = ${active},
               image_url = ${text(v.data.image_url)} where id = ${v.data.id}`
        : tx`insert into public.agents (name, role, image_url, sort_order)
             values (${v.data.name}, ${v.data.role}, ${text(v.data.image_url)},
                     (select coalesce(max(sort_order), 0) + 1 from public.agents))`,
    );
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  return done("/settings/agents", v.data.id ? `${v.data.name} saved.` : `${v.data.name} added.`);
}

export async function deleteAgent(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = z.string().uuid().parse(fd.get("id"));
  try {
    await withActor(actorOf(me), (tx) => tx`delete from public.agents where id = ${id}`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  return done("/settings/agents", "Agent deleted.");
}

// ----------------------------------------------------------------------------- Roles
export async function saveRole(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const v = z
    .object({ id: uuidOrEmpty, name: z.string().trim().min(2, "Enter the role name.").max(40) })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return { error: v.error.issues[0]!.message, fields: {} };
  try {
    await withActor(actorOf(me), (tx) =>
      v.data.id
        ? tx`update public.team_roles set name = ${v.data.name} where id = ${v.data.id}`
        : tx`insert into public.team_roles (name, sort_order)
             values (${v.data.name}, (select coalesce(max(sort_order), 0) + 1 from public.team_roles))`,
    );
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  return done("/settings/roles", v.data.id ? "Role saved." : `${v.data.name} added.`);
}

export async function deleteRole(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = z.string().uuid().parse(fd.get("id"));
  try {
    await withActor(actorOf(me), (tx) => tx`delete from public.team_roles where id = ${id}`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  return done("/settings/roles", "Role deleted. Players who had it now show no role.");
}

// ----------------------------------------------------------------------------- Opponents
export async function saveOpponent(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const v = z
    .object({
      id: uuidOrEmpty,
      name: z.string().trim().min(2, "Enter the opponent name.").max(80),
      short_name: z.string().trim().max(12),
      logo_url: imageUrl,
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return { error: v.error.issues[0]!.message, fields: {} };
  try {
    await withActor(actorOf(me), (tx) =>
      v.data.id
        ? tx`update public.opponents set name = ${v.data.name}, short_name = ${text(v.data.short_name)},
               logo_url = ${text(v.data.logo_url)} where id = ${v.data.id}`
        : tx`insert into public.opponents (name, short_name, logo_url)
             values (${v.data.name}, ${text(v.data.short_name)}, ${text(v.data.logo_url)})`,
    );
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  return done("/settings/opponents", v.data.id ? "Opponent saved." : `${v.data.name} added.`);
}

/** Moves every match and note from one opponent to another, then deletes the duplicate. */
export async function mergeOpponent(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const from = z.string().uuid().safeParse(fd.get("id"));
  const into = z.string().uuid().safeParse(fd.get("into"));
  if (!from.success || !into.success || from.data === into.data) return { error: "Pick the opponent to merge into.", fields: {} };
  try {
    await withActor(actorOf(me), async (tx) => {
      await tx`update public.matches set opponent_id = ${into.data} where opponent_id = ${from.data}`;
      const [notes] = await tx<{ notes: string | null }[]>`select notes from public.opponent_notes where opponent_id = ${from.data}`;
      if (notes?.notes) {
        await tx`insert into public.opponent_notes (opponent_id, notes) values (${into.data}, ${notes.notes})
                 on conflict (opponent_id) do update
                 set notes = coalesce(public.opponent_notes.notes || E'\\n\\n', '') || excluded.notes`;
      }
      await tx`delete from public.opponents where id = ${from.data}`;
    });
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  return done("/settings/opponents", "Opponents merged. All matches now point to one opponent.");
}

export async function deleteOpponent(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = z.string().uuid().parse(fd.get("id"));
  try {
    await withActor(actorOf(me), (tx) => tx`delete from public.opponents where id = ${id}`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  return done("/settings/opponents", "Opponent deleted.");
}
