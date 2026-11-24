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
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clip = (v: FormDataEntryValue | null, max = 4000) => text(v)?.slice(0, max) ?? null;
const date = (v: FormDataEntryValue | null) => (typeof v === "string" && DATE.test(v) ? v : null);
const optUuid = (v: FormDataEntryValue | null) => (uuid.safeParse(v).success ? String(v) : null);

function finish(where: string): never {
  revalidatePath("/", "layout");
  redirect(where);
}

// ----------------------------------------------------------------------------- Feedback
export async function saveFeedback(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const fields: Record<string, string> = {};
  const id = optUuid(fd.get("id"));
  const playerId = optUuid(fd.get("player_id"));
  if (!playerId) fields.player_id = "Pick the player.";
  const category = String(fd.get("category") ?? "");
  if (!(SKILL_CATEGORIES as readonly string[]).includes(category)) fields.category = "Pick a category.";
  const givenOn = date(fd.get("given_on"));
  if (!givenOn) fields.given_on = "Pick the date.";
  const status = String(fd.get("status") ?? "open");
  if (!["open", "in_progress", "resolved"].includes(status)) fields.status = "Pick a status.";
  const clipUrl = text(fd.get("vod_clip_url"));
  if (clipUrl && !/^https?:\/\//.test(clipUrl)) fields.vod_clip_url = "Use a full link starting with https://";
  const row = {
    player_id: playerId,
    given_on: givenOn,
    category,
    status,
    match_id: optUuid(fd.get("match_id")),
    practice_session_id: optUuid(fd.get("practice_session_id")),
    strengths: clip(fd.get("strengths")),
    areas_to_improve: clip(fd.get("areas_to_improve")),
    specific_example: clip(fd.get("specific_example")),
    evidence: clip(fd.get("evidence")),
    vod_clip_url: clipUrl,
    improvement_action: clip(fd.get("improvement_action")),
    follow_up_on: date(fd.get("follow_up_on")),
  };
  if (!row.strengths && !row.areas_to_improve && !row.specific_example && !row.improvement_action)
    fields.areas_to_improve = "Write at least the strengths, the areas to improve or the improvement action.";
  if (Object.keys(fields).length) return { error: "Check the highlighted fields.", fields };
  try {
    await withActor(actorOf(me), (tx) =>
      id
        ? tx`update public.feedback set ${tx(row)} where id = ${id}`
        : tx`insert into public.feedback ${tx({ ...row, created_by: me.userId })}`,
    );
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  finish(`/development?tab=feedback&saved=1&player=${playerId}`);
}

export async function deleteFeedback(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = optUuid(fd.get("id"));
  if (!id) return { error: "That feedback no longer exists.", fields: {} };
  try {
    await withActor(actorOf(me), (tx) => tx`delete from public.feedback where id = ${id}`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  finish("/development?tab=feedback&deleted=1");
}

// ----------------------------------------------------------------------------- Goals
export async function saveGoal(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const fields: Record<string, string> = {};
  const id = optUuid(fd.get("id"));
  const playerId = optUuid(fd.get("player_id"));
  if (!playerId) fields.player_id = "Pick the player.";
  const description = clip(fd.get("description"), 300);
  if (!description) fields.description = "Describe the goal.";
  const progress = int(fd.get("progress")) ?? 0;
  if (progress < 0 || progress > 100) fields.progress = "Progress goes from 0 to 100.";
  const status = String(fd.get("status") ?? "in_progress");
  if (!["not_started", "in_progress", "achieved", "missed"].includes(status)) fields.status = "Pick a status.";
  if (Object.keys(fields).length) return { error: "Check the highlighted fields.", fields };
  const row = {
    player_id: playerId,
    description: description!,
    current_level: clip(fd.get("current_level"), 200),
    target: clip(fd.get("target"), 200),
    deadline: date(fd.get("deadline")),
    progress,
    status,
    comments: clip(fd.get("comments")),
  };
  try {
    await withActor(actorOf(me), (tx) =>
      id ? tx`update public.player_goals set ${tx(row)} where id = ${id}` : tx`insert into public.player_goals ${tx({ ...row, created_by: me.userId })}`,
    );
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  finish(`/development?tab=goals&saved=1&player=${playerId}`);
}

export async function deleteGoal(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = optUuid(fd.get("id"));
  if (!id) return { error: "That goal no longer exists.", fields: {} };
  try {
    await withActor(actorOf(me), (tx) => tx`delete from public.player_goals where id = ${id}`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  finish("/development?tab=goals&deleted=1");
}

// ----------------------------------------------------------------------------- Team objectives
export async function saveObjective(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const fields: Record<string, string> = {};
  const id = optUuid(fd.get("id"));
  const title = clip(fd.get("title"), 200);
  if (!title) fields.title = "Write the objective.";
  const kind = fd.get("kind") === "priority" ? "priority" : "objective";
  const progress = int(fd.get("progress")) ?? 0;
  if (progress < 0 || progress > 100) fields.progress = "Progress goes from 0 to 100.";
  const status = String(fd.get("status") ?? "active");
  if (!["active", "done", "dropped"].includes(status)) fields.status = "Pick a status.";
  if (Object.keys(fields).length) return { error: "Check the highlighted fields.", fields };
  const row = { title: title!, details: clip(fd.get("details")), kind, progress, status, due_on: date(fd.get("due_on")) };
  try {
    await withActor(actorOf(me), (tx) =>
      id ? tx`update public.team_objectives set ${tx(row)} where id = ${id}` : tx`insert into public.team_objectives ${tx({ ...row, created_by: me.userId })}`,
    );
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  finish("/development?tab=objectives&saved=1");
}

export async function deleteObjective(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = optUuid(fd.get("id"));
  if (!id) return { error: "That objective no longer exists.", fields: {} };
  try {
    await withActor(actorOf(me), (tx) => tx`delete from public.team_objectives where id = ${id}`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  finish("/development?tab=objectives&deleted=1");
}
