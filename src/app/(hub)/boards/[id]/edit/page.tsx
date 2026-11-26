import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { boardCatalog, getBoard } from "@/lib/data/boards";
import { BoardEditor, type BoardParentRef } from "@/components/boards/board-editor";
import { isShowcase } from "@/lib/presets";

export const metadata: Metadata = { title: "Edit tactics board" };

export default async function EditBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const viewer = await getViewer();
  const sandbox = isShowcase() && !isStaff(viewer);
  if (!isStaff(viewer) && !sandbox) redirect(viewer.kind === "member" ? `/boards/${id}` : `/login?next=%2Fboards%2F${id}`);
  const data = await withActor(actorOf(viewer), async (tx) => ({
    board: await getBoard(tx, id),
    catalog: await boardCatalog(tx),
  }));
  const b = data.board;
  if (!b) notFound();
  const parent: BoardParentRef | null = b.strategy_id
    ? { kind: "strategy", id: b.strategy_id }
    : b.opponent_id
      ? { kind: "opponent", id: b.opponent_id }
      : b.vod_id
        ? { kind: "vod", id: b.vod_id }
        : b.session_id
          ? { kind: "session", id: b.session_id }
          : b.match_id
            ? { kind: "match", id: b.match_id }
            : null;
  return (
    <BoardEditor
      catalog={data.catalog}
      initial={{
        id: b.id,
        title: b.title,
        notes: b.notes ?? "",
        map_id: b.map_id,
        side: b.side,
        valoplant_url: b.valoplant_url ?? "",
        scene: b.scene,
      }}
      parent={parent}
      parentLabel={b.title}
      backHref={`/boards/${b.id}`}
      sandbox={sandbox}
    />
  );
}
