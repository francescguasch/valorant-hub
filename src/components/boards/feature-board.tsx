import Link from "next/link";
import { Maximize2, Pencil, PenTool, Plus } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import type { BoardCard } from "@/lib/data/boards";
import type { BoardCatalog } from "@/lib/boards/scene";
import { BoardThumb } from "./board-strip";
import { SceneSvg } from "./scene-svg";

/**
 * A record's own board, shown large: the first board drawn for it, with any
 * further boards as thumbnails underneath. Staff get a call to draw it when
 * there is none.
 */
export function FeatureBoard({
  boards,
  catalog,
  canEdit,
  newHref,
  emptyText,
}: {
  boards: BoardCard[];
  catalog: BoardCatalog | null;
  canEdit: boolean;
  newHref: string;
  emptyText: string;
}) {
  // The first board drawn is the record's own board; later ones are variations.
  const [main, ...more] = [...boards].sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (!main || !catalog) {
    return (
      <Panel title="Board">
        <div className="grid aspect-[16/9] place-items-center border border-dashed border-line-strong bg-[#10161d] p-6 text-center">
          <div className="flex max-w-sm flex-col items-center gap-3">
            <PenTool className="size-7 text-fog" aria-hidden />
            <p className="text-fog">{canEdit ? emptyText : "The staff hasn't drawn this board yet."}</p>
            {canEdit ? (
              <Link href={newHref} className={buttonClass("primary")}>
                <PenTool className="size-4" aria-hidden /> Draw the board
              </Link>
            ) : null}
          </div>
        </div>
      </Panel>
    );
  }
  return (
    <Panel
      title={main.title}
      description={more.length ? `Board 1 of ${boards.length}` : undefined}
      action={
        <div className="flex gap-2">
          <Link href={`/boards/${main.id}`} className={buttonClass("ghost")}>
            <Maximize2 className="size-4" aria-hidden /> Open
          </Link>
          {canEdit ? (
            <Link href={`/boards/${main.id}/edit`} className={buttonClass("secondary")}>
              <Pencil className="size-4" aria-hidden /> Edit board
            </Link>
          ) : null}
        </div>
      }
    >
      <Link href={`/boards/${main.id}`} className="block border border-line" aria-label={`Open ${main.title}`}>
        <SceneSvg
          scene={main.scene}
          catalog={catalog}
          mapId={main.map_id}
          uid={`f-${main.id.slice(0, 8)}`}
          title={main.title}
          className="block w-full"
        />
      </Link>
      {more.length || canEdit ? (
        <div className="mt-4">
          <p className="mb-2 text-[13px] text-fog">
            {more.length ? "More boards" : "Add a variation, a retake or a post-plant"}
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {more.map((b) => (
              <BoardThumb key={b.id} board={b} catalog={catalog} />
            ))}
            {canEdit ? (
              <Link
                href={newHref}
                className="grid aspect-square place-items-center border border-dashed border-line-strong text-[14px] text-fog transition-colors hover:border-bone hover:text-bone"
              >
                <span className="flex flex-col items-center gap-1">
                  <Plus className="size-5" aria-hidden /> New board
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

/** Text written one point per line, as a list. */
export function PointList({ text, tone }: { text: string | null; tone: "strong" | "weak" }) {
  const items = (text ?? "")
    .split("\n")
    .map((x) => x.replace(/^[-•*+\s]+/, "").trim())
    .filter(Boolean);
  if (!items.length) return <p className="text-dim">Nothing written yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed text-bone">
          <span
            aria-hidden
            className={tone === "strong" ? "mt-[7px] h-2.5 w-1 shrink-0 bg-win" : "mt-[7px] h-2.5 w-1 shrink-0 bg-loss"}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}
