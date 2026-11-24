"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actorOf } from "@/lib/auth/viewer";
import { DENIED, staffOrNull, text } from "@/lib/auth/guards";
import { friendlyDbError, withActor } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { categoriesFor } from "@/lib/constants";

const uuid = z.string().uuid();
const LONG = 8000;

function clip(v: FormDataEntryValue | null, max = LONG) {
  return text(v)?.slice(0, max) ?? null;
}

export async function saveStrategy(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const fields: Record<string, string> = {};
  const id = text(fd.get("id"));
  const mapId = String(fd.get("map_id") ?? "");
  if (!uuid.safeParse(mapId).success) fields.map_id = "Pick the map.";
  const side = String(fd.get("side") ?? "");
  if (side !== "t" && side !== "ct") fields.side = "Pick T or CT side.";
  const category = String(fd.get("category") ?? "");
  if ((side === "t" || side === "ct") && !categoriesFor(side).some((c) => c.value === category)) fields.category = "Pick a category for this side.";
  const name = clip(fd.get("name"), 80);
  if (!name || name.length < 2) fields.name = "Give the strategy a name.";
  const status = String(fd.get("status") ?? "in_development");
  if (!["in_development", "practicing", "approved"].includes(status)) fields.status = "Pick a status.";
  const youtube = text(fd.get("youtube_url"));
  if (youtube && !/^https?:\/\//.test(youtube)) fields.youtube_url = "Use a full link starting with https://";

  const comp = [0, 1, 2, 3, 4].map((i) => String(fd.get(`comp_${i}`) ?? "")).filter((x) => uuid.safeParse(x).success);
  if (new Set(comp).size !== comp.length) fields.comp = "Each agent can appear only once.";

  const assignments = [0, 1, 2, 3, 4]
    .map((i) => ({
      player_id: uuid.safeParse(fd.get(`as_player_${i}`)).success ? String(fd.get(`as_player_${i}`)) : null,
      agent_id: uuid.safeParse(fd.get(`as_agent_${i}`)).success ? String(fd.get(`as_agent_${i}`)) : null,
      task: clip(fd.get(`as_task_${i}`), 400),
    }))
    .filter((a) => a.player_id || a.agent_id || a.task);

  if (Object.keys(fields).length) return { error: "Check the highlighted fields.", fields };

  const row = {
    map_id: mapId,
    side,
    category,
    name: name!,
    status,
    description: clip(fd.get("description")),
    objective: clip(fd.get("objective")),
    comp_agent_ids: comp,
    assignments,
    starting_positions: clip(fd.get("starting_positions")),
    utility_usage: clip(fd.get("utility_usage")),
    timing: clip(fd.get("timing")),
    callouts: clip(fd.get("callouts")),
    execution: clip(fd.get("execution")),
    alternatives: clip(fd.get("alternatives")),
    common_mistakes: clip(fd.get("common_mistakes")),
    coaching_notes: clip(fd.get("coaching_notes")),
    youtube_url: youtube,
  };

  let savedId = id;
  try {
    savedId = await withActor(actorOf(me), async (tx) => {
      const { assignments: a, ...rest } = row;
      if (id) {
        const r = await tx<{ id: string }[]>`
          update public.strategies set ${tx(rest)}, assignments = ${tx.json(a)} where id = ${id} returning id`;
        if (!r[0]) throw new Error("not-found");
        return r[0].id;
      }
      const r = await tx<{ id: string }[]>`
        insert into public.strategies ${tx({ ...rest, created_by: me.userId })} returning id`;
      await tx`update public.strategies set assignments = ${tx.json(a)} where id = ${r[0]!.id}`;
      return r[0]!.id;
    });
  } catch (e) {
    if ((e as Error).message === "not-found") return { error: "That strategy no longer exists.", fields: {} };
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/playbook", "layout");
  redirect(`/playbook/strategy/${savedId}?saved=1`);
}

export async function duplicateStrategy(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "That strategy no longer exists.", fields: {} };
  let newId: string;
  try {
    newId = await withActor(actorOf(me), async (tx) => {
      const r = await tx<{ id: string }[]>`
        insert into public.strategies (map_id, side, category, name, description, objective, comp_agent_ids, assignments,
          starting_positions, utility_usage, timing, callouts, execution, alternatives, common_mistakes, coaching_notes,
          youtube_url, status, created_by)
        select map_id, side, category, left(name || ' (copy)', 80), description, objective, comp_agent_ids, assignments,
          starting_positions, utility_usage, timing, callouts, execution, alternatives, common_mistakes, coaching_notes,
          youtube_url, 'in_development', ${me.userId}
        from public.strategies where id = ${id.data} returning id`;
      if (!r[0]) throw new Error("not-found");
      return r[0].id;
    });
  } catch (e) {
    return { error: (e as Error).message === "not-found" ? "That strategy no longer exists." : friendlyDbError(e), fields: {} };
  }
  revalidatePath("/playbook", "layout");
  redirect(`/playbook/strategy/${newId}/edit?copied=1`);
}

export async function setArchived(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "That strategy no longer exists.", fields: {} };
  const archive = fd.get("archive") === "true";
  try {
    await withActor(actorOf(me), (tx) =>
      tx`update public.strategies set archived_at = ${archive ? new Date() : null} where id = ${id.data}`,
    );
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/playbook", "layout");
  return { error: null, fields: {}, success: archive ? "Strategy archived. It's hidden from the playbook lists." : "Strategy restored." };
}

export async function deleteStrategy(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "That strategy no longer exists.", fields: {} };
  let mapId: string | undefined;
  try {
    mapId = await withActor(actorOf(me), async (tx) => {
      const r = await tx<{ map_id: string }[]>`delete from public.strategies where id = ${id.data} returning map_id`;
      return r[0]?.map_id;
    });
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/playbook", "layout");
  redirect(mapId ? `/playbook/${mapId}?deleted=1` : "/playbook");
}

export async function saveMapNotes(_p: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return DENIED;
  const mapId = uuid.safeParse(fd.get("map_id"));
  if (!mapId.success) return { error: "Pick the map.", fields: {} };
  const img = text(fd.get("callouts_image_url"));
  if (img && !/^https?:\/\//.test(img)) return { error: null, fields: { callouts_image_url: "Upload an image or use a full https:// link." } };
  const row = {
    map_id: mapId.data,
    overview: clip(fd.get("overview")),
    characteristics: clip(fd.get("characteristics")),
    important_areas: clip(fd.get("important_areas")),
    callouts: clip(fd.get("callouts")),
    strengths: clip(fd.get("strengths")),
    weaknesses: clip(fd.get("weaknesses")),
    recommended_comps: clip(fd.get("recommended_comps")),
    callouts_image_url: img,
  };
  try {
    await withActor(actorOf(me), (tx) => tx`
      insert into public.map_notes ${tx(row)}
      on conflict (map_id) do update set overview = excluded.overview, characteristics = excluded.characteristics,
        important_areas = excluded.important_areas, callouts = excluded.callouts, strengths = excluded.strengths,
        weaknesses = excluded.weaknesses, recommended_comps = excluded.recommended_comps,
        callouts_image_url = excluded.callouts_image_url`);
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/playbook", "layout");
  redirect(`/playbook/${mapId.data}?saved=1`);
}
