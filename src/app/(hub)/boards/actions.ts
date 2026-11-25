"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actorOf } from "@/lib/auth/viewer";
import { staffOrNull } from "@/lib/auth/guards";
import { friendlyDbError, withActor, type Tx } from "@/lib/db";
import { sceneSchema } from "@/lib/boards/scene";
import { PARENT_COLUMN, parentHref, type BoardParent } from "@/lib/data/boards";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { FormState } from "@/lib/forms";

const uuid = z.string().uuid();
const optionalUuid = z.union([uuid, z.literal(""), z.null()]).transform((v) => v || null);

const boardInput = z.object({
  id: optionalUuid,
  title: z.string().trim().min(1, "Give the board a title.").max(120),
  notes: z
    .string()
    .trim()
    .max(4000)
    .transform((v) => v || null),
  map_id: optionalUuid,
  side: z.union([z.enum(["attack", "defense"]), z.literal(""), z.null()]).transform((v) => v || null),
  valoplant_url: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === "" || /^https:\/\/([a-z0-9-]+\.)*valoplant\.gg\//i.test(v),
      "Paste a link that starts with https://valoplant.gg/",
    )
    .transform((v) => v || null),
  image_url: z.union([
    z
      .string()
      .regex(/^https?:\/\//)
      .max(2000),
    z.null(),
  ]),
  scene: sceneSchema,
  parent: z.object({ kind: z.enum(["strategy", "opponent", "vod", "session", "match"]), id: uuid }).nullable(),
});
export type BoardInput = z.input<typeof boardInput>;
export type SaveResult = { ok: true; id: string; href: string } | { ok: false; error: string };

/** Creates or updates a board. The editor uploads the image first and sends its URL. */
export async function saveBoard(input: BoardInput): Promise<SaveResult> {
  const me = await staffOrNull();
  if (!me) return { ok: false, error: "Only coaches and the owner can save boards." };
  const parsed = boardInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path[0] === "scene" ? "the drawing" : String(issue?.path[0] ?? "the form");
    return {
      ok: false,
      error: issue?.message && issue.path[0] !== "scene" ? issue.message : `Couldn't save ${where}. Try again.`,
    };
  }
  const v = parsed.data;
  const row = {
    title: v.title,
    notes: v.notes,
    map_id: v.map_id,
    side: v.side,
    valoplant_url: v.valoplant_url,
    image_url: v.image_url,
    scene: v.scene,
  };
  let previousImage: string | null = null;
  let id: string;
  try {
    ({ id, previousImage } = await withActor(actorOf(me), async (tx) => {
      if (v.id) {
        const [old] = await tx<{ image_url: string | null }[]>`select image_url from public.boards where id = ${v.id}`;
        if (!old) throw new Error("not-found");
        await tx`update public.boards set ${tx({ ...row, scene: tx.json(row.scene) })} where id = ${v.id}`;
        return { id: v.id, previousImage: old.image_url };
      }
      const parentCols = v.parent ? { [PARENT_COLUMN[v.parent.kind]]: v.parent.id } : {};
      const [created] = await tx<{ id: string }[]>`
        insert into public.boards ${tx({ ...row, scene: tx.json(row.scene), ...parentCols, created_by: me.userId })}
        returning id`;
      return { id: created!.id, previousImage: null };
    }));
  } catch (e) {
    if ((e as Error).message === "not-found") return { ok: false, error: "That board no longer exists." };
    return { ok: false, error: friendlyDbError(e) };
  }
  if (previousImage && previousImage !== v.image_url) await removeImageIfUnused(previousImage);
  revalidatePath("/", "layout");
  return { ok: true, id, href: `/boards/${id}` };
}

function parentOfRow(
  r: Record<"strategy_id" | "opponent_id" | "vod_id" | "session_id" | "match_id", string | null>,
): BoardParent | null {
  if (r.strategy_id) return { kind: "strategy", id: r.strategy_id };
  if (r.opponent_id) return { kind: "opponent", id: r.opponent_id };
  if (r.vod_id) return { kind: "vod", id: r.vod_id };
  if (r.session_id) return { kind: "session", id: r.session_id };
  if (r.match_id) return { kind: "match", id: r.match_id };
  return null;
}

/** Deletes a board image from storage unless another board (a duplicate) still shows it. */
async function removeImageIfUnused(url: string, tx?: Tx) {
  const marker = "/storage/v1/object/public/media/";
  const at = url.indexOf(marker);
  if (at < 0) return;
  const path = decodeURIComponent(url.slice(at + marker.length));
  if (!path.startsWith("boards/")) return;
  const me = await staffOrNull();
  if (!me) return;
  const run = async (t: Tx) => (await t`select 1 from public.boards where image_url = ${url} limit 1`).length > 0;
  const stillUsed = tx ? await run(tx) : await withActor(actorOf(me), run);
  if (stillUsed) return;
  try {
    const supabase = await createSupabaseServer();
    await supabase.storage.from("media").remove([path]);
  } catch {
    // An orphaned image is harmless; the board itself is what matters.
  }
}

export async function deleteBoard(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return { error: "Only coaches and the owner can delete boards.", fields: {} };
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "That board no longer exists.", fields: {} };
  let back = "/boards";
  try {
    const removed = await withActor(
      actorOf(me),
      (tx) => tx<
        {
          image_url: string | null;
          map_id: string | null;
          strategy_id: string | null;
          opponent_id: string | null;
          vod_id: string | null;
          session_id: string | null;
          match_id: string | null;
        }[]
      >`
      delete from public.boards where id = ${id.data}
      returning image_url, map_id, strategy_id, opponent_id, vod_id, session_id, match_id`,
    );
    const r = removed[0];
    if (r) {
      back = parentHref(parentOfRow(r), r.map_id);
      if (r.image_url) await removeImageIfUnused(r.image_url);
    }
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  revalidatePath("/", "layout");
  redirect(back);
}

export async function duplicateBoard(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOrNull();
  if (!me) return { error: "Only coaches and the owner can copy boards.", fields: {} };
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "That board no longer exists.", fields: {} };
  let newId: string | undefined;
  try {
    newId = await withActor(actorOf(me), async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        insert into public.boards (title, notes, map_id, side, scene, image_url, valoplant_url,
                                   strategy_id, opponent_id, vod_id, session_id, match_id, created_by)
        select left(title || ' (copy)', 120), notes, map_id, side, scene, image_url, valoplant_url,
               strategy_id, opponent_id, vod_id, session_id, match_id, ${me.userId}
        from public.boards where id = ${id.data}
        returning id`;
      return row?.id;
    });
  } catch (e) {
    return { error: friendlyDbError(e), fields: {} };
  }
  if (!newId) return { error: "That board no longer exists.", fields: {} };
  revalidatePath("/", "layout");
  redirect(`/boards/${newId}/edit`);
}
