import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { actorOf, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { FEEDBACK_STATUS, FEEDBACK_STATUS_LABEL, SKILL_CATEGORIES } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { DemoBadge, EmptyState, FormNotice, Panel } from "@/components/ui/panel";
import { buttonClass } from "@/components/ui/button";
import { VOD_SELECT, type VodRow } from "./load";

export const metadata: Metadata = { title: "VOD Review" };
const UUID = /^[0-9a-f-]{36}$/;

export default async function VodPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { viewer, canEdit } = await sectionAccess("vod");
  const player = sp.player && UUID.test(sp.player) ? sp.player : undefined;
  const map = sp.map && UUID.test(sp.map) ? sp.map : undefined;
  const category = sp.category && (SKILL_CATEGORIES as readonly string[]).includes(sp.category) ? sp.category : undefined;
  const status = sp.status && FEEDBACK_STATUS_LABEL[sp.status] ? sp.status : undefined;
  const { catalog, all } = await withActor(actorOf(viewer), async (tx) => ({
    catalog: await loadCatalog(tx),
    all: await tx.unsafe<VodRow[]>(`${VOD_SELECT} order by created_at desc`),
  }));
  const rows = all.filter(
    (r) => (!player || r.player_id === player || r.assigned_player_id === player) && (!map || r.map_id === map) && (!category || r.category === category) && (!status || r.status === status),
  );

  // Recurring mistakes: by category, last 30 days vs all time, plus open items per player.
  const byCategory = SKILL_CATEGORIES.map((c) => ({
    c,
    total: all.filter((r) => r.category === c).length,
    recent: all.filter((r) => r.category === c && r.recent).length,
  }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.recent - a.recent || b.total - a.total);
  const maxTotal = Math.max(1, ...byCategory.map((x) => x.total));
  const openByPlayer = catalog.players
    .map((p) => ({ p, n: all.filter((r) => r.status !== "resolved" && (r.assigned_player_id ?? r.player_id) === p.id).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  return (
    <>
      <PageHeader
        title="VOD Review"
        description="A library of mistakes and lessons, so the same errors don't repeat."
        actions={
          canEdit ? (
            <Link href="/vod/new" className={buttonClass("primary")}>
              <Plus className="size-4" aria-hidden /> Add review
            </Link>
          ) : null
        }
      />
      <PageBody>
        {sp.deleted ? <FormNotice>Review deleted.</FormNotice> : null}
        {all.length === 0 ? (
          <EmptyState title="No reviews yet" action={canEdit ? <Link href="/vod/new" className={buttonClass("primary")}><Plus className="size-4" aria-hidden /> Add review</Link> : null}>
            Log a moment from a match: the round, the timestamp, what happened and what should have happened.
          </EmptyState>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <FilterBar resetHref="/vod" active={Boolean(player || map || category || status)}>
                <FilterSelect label="Player" name="player" value={player} options={catalog.players.map((p) => ({ value: p.id, label: p.nickname }))} />
                <FilterSelect label="Map" name="map" value={map} options={catalog.maps.map((m) => ({ value: m.id, label: m.name }))} />
                <FilterSelect label="Category" name="category" value={category} options={SKILL_CATEGORIES.map((c) => ({ value: c, label: c }))} />
                <FilterSelect label="Status" name="status" value={status} options={FEEDBACK_STATUS.map((s) => ({ value: s.value, label: s.label }))} />
              </FilterBar>
              {rows.length === 0 ? (
                <EmptyState title="No reviews match these filters" />
              ) : (
                <ul className="flex flex-col gap-3">
                  {rows.map((r) => (
                    <li key={r.id}>
                      <Link href={`/vod/${r.id}`} className="block border border-line bg-panel p-4 transition-colors hover:border-line-strong">
                        <div className="flex flex-wrap items-center gap-2 text-[13px] text-fog">
                          <span className="font-semibold text-bone">{r.player_id ? catalog.playerById.get(r.player_id)?.nickname : "Team"}</span>
                          {r.category ? <span>· {r.category}</span> : null}
                          {r.map_id ? <span>· {catalog.mapById.get(r.map_id)?.name}</span> : null}
                          {r.round_number ? <span>· Round {r.round_number}</span> : null}
                          {r.video_timestamp ? <span>· {r.video_timestamp}</span> : null}
                          <span className="text-dim">· {formatDay(r.created_on)}</span>
                          <span className={clsx("ml-auto border px-1.5 text-[11.5px] font-semibold", r.status === "resolved" ? "border-win/50 text-win" : r.status === "in_progress" ? "border-demo/50 text-demo" : "border-line-strong text-fog")}>
                            {FEEDBACK_STATUS_LABEL[r.status]}
                          </span>
                          {r.is_demo ? <DemoBadge /> : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-bone">{r.what_happened}</p>
                        {r.improvement_action ? <p className="mt-1 line-clamp-1 text-[13.5px] text-fog">Fix: {r.improvement_action}</p> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col gap-5">
              <Panel title="Recurring mistakes" description="Reviews per category. The darker part is the last 30 days.">
                {byCategory.length === 0 ? (
                  <p className="text-dim">Add categories to reviews to see patterns.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {byCategory.map((x) => (
                      <li key={x.c}>
                        <div className="mb-1 flex items-baseline justify-between text-[14px]">
                          <Link href={`/vod?category=${encodeURIComponent(x.c)}`} className="text-bone hover:underline">
                            {x.c}
                          </Link>
                          <span className="num text-[15px] text-fog">
                            {x.recent} recent · {x.total} total
                          </span>
                        </div>
                        <span className="relative block h-2 bg-line" aria-hidden>
                          <span className="absolute inset-y-0 left-0 bg-accent-2/35" style={{ width: `${(x.total / maxTotal) * 100}%` }} />
                          <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-accent-2/90" style={{ width: `${(x.recent / maxTotal) * 100}%` }} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              {openByPlayer.length ? (
                <Panel title="Open items by player">
                  <ul className="flex flex-col gap-2">
                    {openByPlayer.map(({ p, n }) => (
                      <li key={p.id} className="flex justify-between text-[14.5px]">
                        <Link href={`/vod?player=${p.id}`} className="text-bone hover:underline">
                          {p.nickname}
                        </Link>
                        <span className="num text-[16px] text-fog">{n}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
