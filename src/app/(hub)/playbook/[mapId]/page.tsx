/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ChevronLeft, Pencil, PlayCircle, Plus } from "lucide-react";
import { actorOf, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { compAgents, loadCatalog, type Catalog } from "@/lib/data/catalog";
import { getMapNotes, strategiesForMap, type Strategy } from "@/lib/data/playbook";
import { listMatches } from "@/lib/data/matches";
import { compStats, formatPct, record, sideStats } from "@/lib/stats/matches";
import { STRATEGY_STATUS_LABEL, categoriesFor } from "@/lib/constants";
import { PageBody } from "@/components/shell/page-header";
import { boardsFor, strategyBoards, type BoardCard } from "@/lib/data/boards";
import { BoardStrip } from "@/components/boards/board-strip";
import { PointList } from "@/components/boards/feature-board";
import { SceneSvg } from "@/components/boards/scene-svg";
import type { BoardCatalog } from "@/lib/boards/scene";
import { FormNotice, Panel, DemoBadge } from "@/components/ui/panel";
import { Comp, SmallSample } from "@/components/ui/agent";
import { buttonClass } from "@/components/ui/button";
import { MatchList } from "@/components/matches/match-list";
import { StatusBadge } from "@/components/playbook/status-badge";

export const metadata: Metadata = { title: "Map" };

type Tab = "overview" | "t" | "ct";

export default async function MapPage({
  params,
  searchParams,
}: {
  params: Promise<{ mapId: string }>;
  searchParams: Promise<{ tab?: string; status?: string; archived?: string; saved?: string; deleted?: string }>;
}) {
  const { mapId } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(mapId)) notFound();
  const { viewer, canEdit } = await sectionAccess("playbook");
  const data = await withActor(actorOf(viewer), async (tx) => ({
    catalog: await loadCatalog(tx),
    notes: await getMapNotes(tx, mapId),
    strategies: await strategiesForMap(tx, mapId),
    matches: await listMatches(tx, { map: mapId }),
    boards: await boardsFor(tx, { kind: "map", id: mapId }),
    strategyBoards: await strategyBoards(tx, mapId),
  }));
  const map = data.catalog.mapById.get(mapId);
  if (!map) notFound();
  const tab: Tab = sp.tab === "t" || sp.tab === "ct" ? sp.tab : "overview";
  const status = sp.status && STRATEGY_STATUS_LABEL[sp.status] ? sp.status : undefined;
  const showArchived = sp.archived === "1";
  const live = data.strategies.filter((s) => !s.archived_at);
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Gameplan" },
    { key: "t", label: "T side", count: live.filter((s) => s.side === "t").length },
    { key: "ct", label: "CT side", count: live.filter((s) => s.side === "ct").length },
  ];

  return (
    <>
      <header className="relative isolate overflow-hidden border-b border-line">
        {map.splash ? (
          <img src={map.splash} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-45" />
        ) : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/75 to-ink/20" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-ink to-transparent" />
        <div className="px-5 pt-6 sm:px-8">
          <Link href="/playbook" className="inline-flex items-center gap-1 text-[14px] text-fog hover:text-bone">
            <ChevronLeft className="size-4" aria-hidden /> Map Playbook
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4 pb-6">
            <div>
              <p className="text-[14px] text-fog">
                {map.in_rotation ? "Active competitive pool" : "Outside competitive rotation"}
              </p>
              <h1 className="type-display text-[64px] font-extrabold text-bone sm:text-[88px]">{map.name}</h1>
            </div>
            {canEdit ? (
              <Link
                href={`/playbook/${map.id}/new?side=${tab === "ct" ? "ct" : "t"}`}
                className={buttonClass("primary")}
              >
                <Plus className="size-4" aria-hidden /> Add strategy
              </Link>
            ) : null}
          </div>
          <nav aria-label="Map sections" className="flex gap-6">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`/playbook/${map.id}${t.key === "overview" ? "" : `?tab=${t.key}`}`}
                aria-current={tab === t.key ? "page" : undefined}
                className={clsx(
                  "relative pb-3 text-[15px] font-medium",
                  tab === t.key ? "text-bone" : "text-fog hover:text-bone",
                )}
              >
                {t.label}
                {t.count !== undefined ? <span className="ml-1.5 text-dim">{t.count}</span> : null}
                <span
                  aria-hidden
                  className={clsx(
                    "absolute inset-x-0 bottom-0 h-[2px] bg-accent",
                    tab === t.key ? "opacity-100" : "opacity-0",
                  )}
                />
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <PageBody>
        {sp.saved ? <FormNotice>Saved.</FormNotice> : null}
        {sp.deleted ? <FormNotice>Strategy deleted.</FormNotice> : null}
        {tab === "overview" ? (
          <Overview mapId={map.id} notes={data.notes} canEdit={canEdit} catalog={data.catalog} matches={data.matches}>
            <BoardStrip
              title="Map boards"
              boards={data.boards.boards}
              catalog={data.boards.catalog}
              canEdit={canEdit}
              newHref={`/boards/new?map=${map.id}`}
              description={`Defaults, setups, map control and rotations on ${map.name}. Each strategy has its own board on the T and CT tabs.`}
            />
          </Overview>
        ) : (
          <SideView
            mapId={map.id}
            side={tab}
            strategies={data.strategies.filter(
              (s) => s.side === tab && (showArchived ? true : !s.archived_at) && (!status || s.status === status),
            )}
            catalog={data.catalog}
            canEdit={canEdit}
            status={status}
            showArchived={showArchived}
            boards={data.strategyBoards}
          />
        )}
      </PageBody>
    </>
  );
}

function Overview({
  mapId,
  notes,
  canEdit,
  catalog,
  matches,
  children,
}: {
  children?: React.ReactNode;
  mapId: string;
  notes: Awaited<ReturnType<typeof getMapNotes>>;
  canEdit: boolean;
  catalog: Catalog;
  matches: Awaited<ReturnType<typeof listMatches>>;
}) {
  const r = record(matches);
  const sides = sideStats(matches);
  const comps = compStats(matches).slice(0, 4);
  const edit = canEdit ? (
    <Link href={`/playbook/${mapId}/notes`} className={buttonClass("ghost")}>
      <Pencil className="size-4" aria-hidden /> Edit
    </Link>
  ) : null;
  const empty = (what: string) => (
    <p className="text-dim">{canEdit ? `Write ${what} with Edit.` : "The staff hasn't written this yet."}</p>
  );
  const text = (v: string | null | undefined) => (
    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-bone">{v}</p>
  );
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <Panel title="Gameplan" description="How we want to play this map, on each side." action={edit}>
          <div className="grid gap-6 lg:grid-cols-2">
            {(
              [
                ["Attack (T side)", notes?.gameplan_attack, "the attack gameplan"],
                ["Defense (CT side)", notes?.gameplan_defense, "the defense gameplan"],
              ] as const
            ).map(([label, value, what]) => (
              <div key={label} className="min-w-0">
                <h3 className="type-display mb-2 text-[17px] font-bold text-accent">{label}</h3>
                {value ? text(value) : empty(what)}
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="How we read the map"
          description="Key areas, map control, rotations and timings, as the coach sees them."
          action={edit}
        >
          <div className="flex flex-col gap-5">
            {notes?.map_reading ? text(notes.map_reading) : empty("how the team reads this map")}
            {notes?.callouts_image_url ? (
              <a href={notes.callouts_image_url} target="_blank" rel="noopener noreferrer">
                <img src={notes.callouts_image_url} alt="Callouts" className="w-full border border-line" />
              </a>
            ) : null}
          </div>
        </Panel>
        {children}
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Strong points" description="Where we are good on this map.">
            <PointList text={notes?.strengths ?? null} tone="strong" />
          </Panel>
          <Panel title="Weak points" description="What to fix or avoid here.">
            <PointList text={notes?.weaknesses ?? null} tone="weak" />
          </Panel>
        </div>
        {notes?.recommended_comps ? (
          <Panel title="Recommended compositions">{text(notes.recommended_comps)}</Panel>
        ) : null}
      </div>

      <div className="flex flex-col gap-5">
        <Panel title="History on this map">
          {r.played === 0 ? (
            <p className="text-dim">No recorded matches on this map yet.</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-4">
                {[
                  ["Record", `${r.wins}W ${r.losses}L${r.draws ? ` ${r.draws}D` : ""}`],
                  ["Win rate", formatPct(r.winRate)],
                  ["T rounds won", formatPct(sides.t.rate)],
                  ["CT rounds won", formatPct(sides.ct.rate)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[12.5px] text-fog">{k}</dt>
                    <dd className="num text-[28px] font-semibold text-bone">{v}</dd>
                  </div>
                ))}
              </dl>
              {r.smallSample ? (
                <div className="mt-2">
                  <SmallSample played={r.played} />
                </div>
              ) : null}
              {comps.length ? (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="mb-3 text-[13px] text-fog">Compositions played here</p>
                  <ul className="flex flex-col gap-3">
                    {comps.map((c) => (
                      <li key={c.key} className="flex items-center justify-between gap-3">
                        <Comp agents={compAgents(catalog, c.agentIds)} size={26} />
                        <span className="num text-[16px] text-bone">
                          {c.wins}W {c.losses}L · {formatPct(c.winRate)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </Panel>
        {matches.length ? (
          <div>
            <h2 className="type-display mb-3 text-[19px] font-bold">Recent matches here</h2>
            <MatchList matches={matches.slice(0, 5)} catalog={catalog} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SideView({
  mapId,
  side,
  strategies,
  catalog,
  canEdit,
  status,
  showArchived,
  boards,
}: {
  boards: { byStrategy: Map<string, BoardCard>; catalog: BoardCatalog | null };
  mapId: string;
  side: "t" | "ct";
  strategies: Strategy[];
  catalog: Catalog;
  canEdit: boolean;
  status?: string;
  showArchived: boolean;
}) {
  const base = `/playbook/${mapId}?tab=${side}`;
  const filterLink = (s?: string, archived = showArchived) =>
    `${base}${s ? `&status=${s}` : ""}${archived ? "&archived=1" : ""}`;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <span className="mr-1 text-fog">Status</span>
        {[undefined, "in_development", "practicing", "approved"].map((s) => (
          <Link
            key={s ?? "all"}
            href={filterLink(s)}
            className={clsx(
              "border px-3 py-1.5",
              status === s ? "border-accent text-bone" : "border-line text-fog hover:text-bone",
            )}
          >
            {s ? STRATEGY_STATUS_LABEL[s] : "All"}
          </Link>
        ))}
        <Link
          href={filterLink(status, !showArchived)}
          className="ml-auto text-fog underline-offset-4 hover:text-bone hover:underline"
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </Link>
      </div>
      {categoriesFor(side).map((cat) => {
        const items = strategies.filter((s) => s.category === cat.value);
        return (
          <section key={cat.value}>
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-2">
              <h2 className="type-display text-[20px] font-bold text-bone">
                {cat.label} <span className="ml-1 text-[15px] text-dim">{items.length}</span>
              </h2>
              {canEdit ? (
                <Link
                  href={`/playbook/${mapId}/new?side=${side}&category=${cat.value}`}
                  className="inline-flex items-center gap-1 text-[13.5px] text-fog hover:text-bone"
                >
                  <Plus className="size-3.5" aria-hidden /> Add
                </Link>
              ) : null}
            </div>
            {items.length === 0 ? (
              <p className="text-[14px] text-dim">Nothing here yet.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {items.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/playbook/strategy/${s.id}`}
                      className="flex h-full gap-3 border border-line bg-panel p-3 transition-colors hover:border-line-strong"
                    >
                      <StrategyThumb board={boards.byStrategy.get(s.id)} catalog={boards.catalog} />
                      <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-bone">{s.name}</p>
                          <StatusBadge status={s.status} />
                        </div>
                        {s.objective || s.description ? (
                          <p className="line-clamp-2 text-[13.5px] text-fog">{s.objective ?? s.description}</p>
                        ) : null}
                        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                          {s.comp_agent_ids.length ? (
                            <Comp agents={compAgents(catalog, s.comp_agent_ids)} size={22} />
                          ) : (
                            <span />
                          )}
                          <span className="flex items-center gap-2 text-[12.5px] text-dim">
                            {s.archived_at ? "Archived" : null}
                            {s.is_demo ? <DemoBadge /> : null}
                            {s.youtube_url ? <PlayCircle className="size-4 text-fog" aria-label="Has video" /> : null}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** The strategy's own board in miniature, or an empty tile when it hasn't been drawn. */
function StrategyThumb({ board, catalog }: { board: BoardCard | undefined; catalog: BoardCatalog | null }) {
  return (
    <div className="aspect-square w-[104px] shrink-0 overflow-hidden border border-line bg-[#10161d]">
      {board && catalog ? (
        <SceneSvg
          scene={board.scene}
          catalog={catalog}
          mapId={board.map_id}
          uid={`s-${board.id.slice(0, 8)}`}
          title={board.title}
          className="block size-full"
        />
      ) : (
        <span className="grid size-full place-items-center text-[11.5px] text-dim">No board</span>
      )}
    </div>
  );
}
