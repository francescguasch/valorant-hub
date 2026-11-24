"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actorOf } from "@/lib/auth/viewer";
import { DENIED, staffOrNull, text } from "@/lib/auth/guards";
import { friendlyDbError, withActor } from "@/lib/db";
import type { FormState } from "@/lib/forms";

const uuid = z.string().uuid();

export async function savePlayer(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const fields: Record<string, string> = {};
  const id = text(fd.get("id"));
  const nickname = text(fd.get("nickname"))?.slice(0, 30);
  if (!nickname || nickname.length < 2) fields.nickname = "Enter the player's nickname.";
  const photo = text(fd.get("photo_url"));
  if (photo && !/^https?:\/\//.test(photo)) fields.photo_url = "Upload a photo or use a full https:// link.";
  const role = (k: string) => (uuid.safeParse(fd.get(k)).success ? String(fd.get(k)) : null);
  const main = fd.getAll("main_agent").map(String).filter((x) => uuid.safeParse(x).success);
  const secondary = fd.getAll("secondary_agent").map(String).filter((x) => uuid.safeParse(x).success && !main.includes(x));
  if (Object.keys(fields).length) return { error: "Check the highlighted fields.", fields };

  const player = {
    nickname: nickname!,
    photo_url: photo,
    main_role_id: role("main_role_id"),
    secondary_role_id: role("secondary_role_id"),
    main_agent_ids: main,
    secondary_agent_ids: secondary,
    active: fd.get("active") === "on",
  };
  const details = {
    real_name: text(fd.get("real_name"))?.slice(0, 80) ?? null,
    strengths: text(fd.get("strengths"))?.slice(0, 4000) ?? null,
    weaknesses: text(fd.get("weaknesses"))?.slice(0, 4000) ?? null,
    notes: text(fd.get("notes"))?.slice(0, 4000) ?? null,
  };

  let savedId = id;
  try {
    savedId = await withActor(actorOf(me), async (tx) => {
      let pid: string;
      if (id) {
        const r = await tx<{ id: string }[]>`update public.players set ${tx(player)} where id = ${id} returning id`;
        if (!r[0]) throw new Error("not-found");
        pid = r[0].id;
      } else {
        pid = (
          await tx<{ id: string }[]>`insert into public.players ${tx({ ...player, sort_order: 100 })} returning id`
        )[0]!.id;
      }
      await tx`insert into public.player_details ${tx({ player_id: pid, ...details })}
               on conflict (player_id) do update set real_name = excluded.real_name, strengths = excluded.strengths,
                 weaknesses = excluded.weaknesses, notes = excluded.notes`;
      return pid;
    });
  } catch (e) {
    if ((e as Error).message === "not-found") return { error: "That player no longer exists.", fields: {} };
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/", "layout");
  redirect(`/roster/${savedId}?saved=1`);
}

export async function deletePlayer(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "That player no longer exists.", fields: {} };
  try {
    await withActor(actorOf(me), (tx) => tx`delete from public.players where id = ${id.data}`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/", "layout");
  redirect("/roster?deleted=1");
}
