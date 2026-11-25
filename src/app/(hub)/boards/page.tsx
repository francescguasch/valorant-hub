import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { actorOf, isStaff, requireMember } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { listBoards, SECTION_LABEL, type BoardSection } from "@/lib/data/boards";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { BoardThumb } from "@/components/boards/board-strip";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/panel";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";

export const metadata: Metadata = { title: "Tactics boards" };

export default async function BoardsPage({
  searchParams,
}: {
  searchParams: Promise<{ map?: string; section?: string; side?: string }>;
}) {
  const me = await requireMember("/boards");
  const sp = await searchParams;
  const { boards, maps } = await withActor(actorOf(me), async (tx) => ({
    boards: await listBoards(tx, { kind: "all" }),
    maps: await tx<
      { id: string; name: string }[]
    >`select id, name from public.maps where active order by in_rotation desc, sort_order, name`,
  }));
  const mapName = maps.find((m) => m.id === sp.map)?.name;
  const shown = boards.filter(
    (b) =>
      (!mapName || b.map_name === mapName) &&
      (!sp.section || b.section === sp.section) &&
      (!sp.side || b.side === sp.side),
  );
  const active = Boolean(sp.map || sp.section || sp.side);
  const canEdit = isStaff(me);

  return (
    <>
      <PageHeader
        title="Tactics boards"
        description="Every plan drawn on the map, from the playbook, scouting, VOD reviews, practice and matches."
        actions={
          canEdit ? (
            <Link href={sp.map ? `/boards/new?map=${sp.map}` : "/boards/new"} className={buttonClass("primary")}>
              <Plus className="size-4" aria-hidden /> New board
            </Link>
          ) : null
        }
      />
      <PageBody>
        <FilterBar resetHref="/boards" active={active}>
          <FilterSelect
            label="Map"
            name="map"
            value={sp.map}
            options={maps.map((m) => ({ value: m.id, label: m.name }))}
          />
          <FilterSelect
            label="Section"
            name="section"
            value={sp.section}
            options={(Object.keys(SECTION_LABEL) as BoardSection[]).map((k) => ({ value: k, label: SECTION_LABEL[k] }))}
          />
          <FilterSelect
            label="Side"
            name="side"
            value={sp.side}
            options={[
              { value: "attack", label: "Attack" },
              { value: "defense", label: "Defense" },
            ]}
          />
        </FilterBar>
        {shown.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {shown.map((b) => (
              <BoardThumb key={b.id} board={b} showSection />
            ))}
          </div>
        ) : (
          <EmptyState
            title={active ? "No boards match these filters" : "No boards yet"}
            action={
              canEdit && !active ? (
                <Link href="/boards/new" className={buttonClass("secondary")}>
                  <Plus className="size-4" aria-hidden /> Draw the first one
                </Link>
              ) : null
            }
          >
            {active
              ? "Clear the filters to see every board."
              : "Boards are drawn plans on the map: agents, utility, arrows and zones."}
          </EmptyState>
        )}
      </PageBody>
    </>
  );
}
