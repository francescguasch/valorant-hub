"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actorOf } from "@/lib/auth/viewer";
import { DENIED, staffOrNull, text } from "@/lib/auth/guards";
import { friendlyDbError, withActor } from "@/lib/db";
import type { FormState } from "@/lib/forms";

export async function saveScoutingNotes(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = z.string().uuid().safeParse(fd.get("opponent_id"));
  if (!id.success) return { error: "That opponent no longer exists.", fields: {} };
  const notes = text(fd.get("notes"))?.slice(0, 12000) ?? null;
  try {
    await withActor(actorOf(me), (tx) => tx`
      insert into public.opponent_notes (opponent_id, notes) values (${id.data}, ${notes})
      on conflict (opponent_id) do update set notes = excluded.notes`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath(`/scouting/${id.data}`);
  return { error: null, fields: {}, success: "Scouting notes saved." };
}
