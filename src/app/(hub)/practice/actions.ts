"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actorOf } from "@/lib/auth/viewer";
import { DENIED, int, staffOrNull, text } from "@/lib/auth/guards";
import { friendlyDbError, withActor } from "@/lib/db";
import { getSettings } from "@/lib/data/settings";
import type { FormState } from "@/lib/forms";

const uuid = z.string().uuid();
const optUuid = (v: FormDataEntryValue | null) => (uuid.safeParse(v).success ? String(v) : null);
const clip = (v: FormDataEntryValue | null, max = 4000) => text(v)?.slice(0, max) ?? null;

export async function saveSession(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const fields: Record<string, string> = {};
  const id = optUuid(fd.get("id"));
  const day = String(fd.get("day") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fields.day = "Pick the date.";
  const time = String(fd.get("time") ?? "");
  if (!/^\d{2}:\d{2}$/.test(time)) fields.time = "Pick the start time.";
  const duration = int(fd.get("duration_min"));
  if (duration === null || duration < 15 || duration > 720) fields.duration_min = "Duration goes from 15 to 720 minutes.";
  const sessionType = clip(fd.get("session_type"), 60);
  if (!sessionType) fields.session_type = "Pick the session type.";
  const status = String(fd.get("status") ?? "planned");
  if (!["planned", "completed", "cancelled"].includes(status)) fields.status = "Pick a status.";
  if (Object.keys(fields).length) return { error: "Check the highlighted fields.", fields };

  const { timezone } = await getSettings();
  const row = {
    duration_min: duration!,
    session_type: sessionType!,
    map_id: optUuid(fd.get("map_id")),
    strategy_id: optUuid(fd.get("strategy_id")),
    objective: clip(fd.get("objective")),
    attending_player_ids: fd.getAll("attending").map(String).filter((x) => uuid.safeParse(x).success),
    outcome: clip(fd.get("outcome")),
    coach_notes: clip(fd.get("coach_notes")),
    next_steps: clip(fd.get("next_steps")),
    status,
  };
  let savedId = id;
  try {
    savedId = await withActor(actorOf(me), async (tx) => {
      // The date and time are in the team's timezone; Postgres converts them to an exact instant.
      const r = id
        ? await tx<{ id: string }[]>`update public.practice_sessions set ${tx(row)},
            starts_at = (${day}::date + ${time}::time) at time zone ${timezone} where id = ${id} returning id`
        : await tx<{ id: string }[]>`insert into public.practice_sessions ${tx({ ...row, starts_at: new Date(0), created_by: me.userId })} returning id`;
      if (!r[0]) throw new Error("not-found");
      if (!id) await tx`update public.practice_sessions set starts_at = (${day}::date + ${time}::time) at time zone ${timezone} where id = ${r[0].id}`;
      return r[0].id;
    });
  } catch (e) {
    if ((e as Error).message === "not-found") return { error: "That session no longer exists.", fields: {} };
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/", "layout");
  redirect(`/practice/${savedId}?saved=1`);
}

export async function deleteSession(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = optUuid(fd.get("id"));
  if (!id) return { error: "That session no longer exists.", fields: {} };
  try {
    await withActor(actorOf(me), (tx) => tx`delete from public.practice_sessions where id = ${id}`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/", "layout");
  redirect("/practice?deleted=1");
}
