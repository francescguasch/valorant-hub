import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChevronLeft, Copy, ExternalLink, Pencil } from "lucide-react";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { boardCatalog, getBoard, SECTION_LABEL } from "@/lib/data/boards";
import { SceneSvg } from "@/components/boards/scene-svg";
import { BoardDownloadButton } from "@/components/boards/download-button";
import { buttonClass } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm";
import { FormNotice, Panel } from "@/components/ui/panel";
import { deleteBoard, duplicateBoard } from "../actions";

export const metadata: Metadata = { title: "Tactics board" };

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const viewer = await getViewer();
  const data = await withActor(actorOf(viewer), async (tx) => {
    const board = await getBoard(tx, id);
    return { board, catalog: board ? await boardCatalog(tx) : null };
  });
  const b = data.board;
  if (!b || !data.catalog) notFound();
  const canEdit = isStaff(viewer);
  const back =
    b.parent ??
    (b.map_id
      ? { label: `${b.map_name} playbook`, href: `/playbook/${b.map_id}` }
      : { label: "Tactics boards", href: "/boards" });
  const meta = [
    b.map_name,
    b.side === "attack" ? "Attack" : b.side === "defense" ? "Defense" : null,
    SECTION_LABEL[b.section],
    `updated ${new Date(b.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const fileName =
    b.title
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "board";

  return (
    <>
      <header className="flex flex-col gap-4 border-b border-line px-5 pb-6 pt-6 sm:px-8">
        <Link href={back.href} className="inline-flex items-center gap-1 text-[14px] text-fog hover:text-bone">
          <ChevronLeft className="size-4" aria-hidden /> {back.label}
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="type-display text-[34px] font-extrabold text-bone sm:text-[42px]">{b.title}</h1>
            <p className="mt-1 text-fog">{meta}</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <BoardDownloadButton
              scene={b.scene}
              catalog={data.catalog}
              mapId={b.map_id}
              fileName={fileName}
              fallbackUrl={b.image_url}
            />
            {b.valoplant_url ? (
              <a href={b.valoplant_url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                <ExternalLink className="size-4" aria-hidden /> Open in ValoPlant
              </a>
            ) : null}
            {canEdit ? (
              <>
                <Link href={`/boards/${b.id}/edit`} className={buttonClass("primary")}>
                  <Pencil className="size-4" aria-hidden /> Edit
                </Link>
                <ConfirmAction
                  action={duplicateBoard}
                  hidden={{ id: b.id }}
                  variant="secondary"
                  label={
                    <>
                      <Copy className="size-4" aria-hidden /> Duplicate
                    </>
                  }
                  confirmLabel="Make a copy"
                  question="Copy this board to adapt it?"
                />
                <ConfirmAction
                  action={deleteBoard}
                  hidden={{ id: b.id }}
                  label="Delete"
                  confirmLabel="Delete board"
                  question="Delete this board and its image?"
                />
              </>
            ) : null}
          </div>
        </div>
      </header>
      <div className="px-5 py-6 sm:px-8 sm:py-8">
        {saved ? <FormNotice>Board saved. The team can see it now.</FormNotice> : null}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-120px))] border border-line">
            <SceneSvg
              scene={b.scene}
              catalog={data.catalog}
              mapId={b.map_id}
              uid={`v-${b.id.slice(0, 8)}`}
              className="block size-full"
              title={b.title}
            />
          </div>
          <div className="flex flex-col gap-4">
            <Panel title="Notes">
              {b.notes ? (
                <p className="whitespace-pre-line text-bone">{b.notes}</p>
              ) : (
                <p className="text-fog">No notes on this board.</p>
              )}
            </Panel>
            {b.created_by_name ? <p className="text-[13px] text-dim">Drawn by {b.created_by_name}</p> : null}
          </div>
        </div>
      </div>
    </>
  );
}
