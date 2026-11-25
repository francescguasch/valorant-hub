/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { SECTION_LABEL, type BoardCard } from "@/lib/data/boards";

export function BoardThumb({ board, showSection }: { board: BoardCard; showSection?: boolean }) {
  const meta = [board.map_name, board.side === "attack" ? "Attack" : board.side === "defense" ? "Defense" : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={`/boards/${board.id}`}
      className="group flex min-w-0 flex-col border border-line bg-rail transition-colors hover:border-line-strong"
    >
      <div className="aspect-square overflow-hidden bg-[#10161d]">
        {board.image_url ? (
          <img
            src={board.image_url}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="type-display grid size-full place-items-center text-[28px] font-extrabold text-line-strong">
            {(board.map_name ?? "Board").toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 px-3 py-2.5">
        <p className="truncate font-semibold text-bone">{board.title}</p>
        <p className="truncate text-[12.5px] text-fog">
          {meta || "No map"}
          {showSection ? ` · ${SECTION_LABEL[board.section]}` : ""}
        </p>
      </div>
    </Link>
  );
}

/** The boards that belong to one record, plus "New board" for staff. */
export function BoardStrip({
  boards,
  newHref,
  canEdit,
  title = "Tactics boards",
  description,
  className,
}: {
  boards: BoardCard[];
  newHref: string;
  canEdit: boolean;
  title?: string;
  description?: string;
  className?: string;
}) {
  if (!boards.length && !canEdit) return null;
  return (
    <Panel
      title={title}
      description={description ?? "Drawn plans on the map. Open one to see it large or download it."}
      className={className}
      action={
        canEdit ? (
          <Link href={newHref} className={buttonClass("secondary")}>
            <Plus className="size-4" aria-hidden /> New board
          </Link>
        ) : null
      }
    >
      {boards.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {boards.map((b) => (
            <BoardThumb key={b.id} board={b} />
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-fog">
          No boards yet. Draw the plan on the map with agents, utility, arrows and zones.
        </p>
      )}
    </Panel>
  );
}
