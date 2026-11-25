"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actorOf } from "@/lib/auth/viewer";
import { DENIED, int, staffOrNull, text } from "@/lib/auth/guards";
import { friendlyDbError, withActor } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { SKILL_CATEGORIES } from "@/lib/constants";

const uuid = z.string().uuid();
const optUuid = (v: FormDataEntryValue | null) => (uuid.safeParse(v).success ? String(v) : null);
const clip = (v: FormDataEntryValue | null, max = 4000) => text(v)?.slice(0, max) ?? null;

export async function saveVod(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const fields: Record<string, string> = {};
  const id = optUuid(fd.get("id"));
  const what = clip(fd.get("what_happened"));
  if (!what) fields.what_happened = "Describe what happened.";
  const category = text(fd.get("category"));
  if (category && !(SKILL_CATEGORIES as readonly string[]).includes(category)) fields.category = "Pick a category.";
  const round = int(fd.get("round_number"));
  if (round !== null && (round < 1 || round > 60)) fields.round_number = "Round goes from 1 to 60.";
  const ts = text(fd.get("video_timestamp"));
  if (ts && !/^(\d{1,2}:)?\d{1,2}:\d{2}$/.test(ts)) fields.video_timestamp = "Use mm:ss or h:mm:ss, e.g. 12:34.";
  const clipUrl = text(fd.get("clip_url"));
  if (clipUrl && !/^https?:\/\//.test(clipUrl)) fields.clip_url = "Use a full link starting with https://";
  const status = String(fd.get("status") ?? "open");
  if (!["open", "in_progress", "resolved"].includes(status)) fields.status = "Pick a status.";
  const assigned = optUuid(fd.get("assigned_player_id"));
  const involved = optUuid(fd.get("player_id"));
  const improvement = clip(fd.get("improvement_action"));
  if (Object.keys(fields).length) return { error: "Check the highlighted fields.", fields };

  const row = {
    match_id: optUuid(fd.get("match_id")),
    map_id: optUuid(fd.get("map_id")),
    round_number: round,
    video_timestamp: ts,
    clip_url: clipUrl,
    player_id: involved,
    category,
    what_happened: what!,
    should_have_happened: clip(fd.get("should_have_happened")),
    improvement_action: improvement,
    assigned_player_id: assigned,
    status,
  };
  let savedId = id;
  try {
    savedId = await withActor(actorOf(me), async (tx) => {
      // The map follows the match when one is picked.
      if (row.match_id && !row.map_id) {
        row.map_id = (await tx<{ map_id: string }[]>`select map_id from public.matches where id = ${row.match_id}`)[0]?.map_id ?? null;
      }
      const vid = id
        ? (await tx<{ id: string }[]>`update public.vod_reviews set ${tx(row)} where id = ${id} returning id`)[0]?.id
        : (await tx<{ id: string }[]>`insert into public.vod_reviews ${tx({ ...row, created_by: me.userId })} returning id`)[0]!.id;
      if (!vid) throw new Error("not-found");
      return vid;
    });
  } catch (e) {
    if ((e as Error).message === "not-found") return { error: "That review no longer exists.", fields: {} };
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/", "layout");
  redirect(`/vod/${savedId}?saved=1`);
}

export async function deleteVod(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = optUuid(fd.get("id"));
  if (!id) return { error: "That review no longer exists.", fields: {} };
  try {
    await withActor(actorOf(me), (tx) => tx`delete from public.vod_reviews where id = ${id}`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/", "layout");
  redirect("/vod?deleted=1");
}
