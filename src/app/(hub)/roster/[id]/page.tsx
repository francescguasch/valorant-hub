/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { ChevronDown, ChevronLeft, Pencil } from "lucide-react";
import { actorOf, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog, type Catalog } from "@/lib/data/catalog";
import { getPlayer, playerGames } from "@/lib/data/players";
import { MATCH_TYPE_LABEL } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { MIN_SAMPLE } from "@/lib/stats/matches";
import {
  byType,
  defaultSlots,
  fmt,
  perf,
  perfBy,
  slotGames,
  tier,
  TYPE_FILTER_LABEL,
  type Perf,
  type PlayerGame,
  type RadarKey,
  type TypeFilter,
} from "@/lib/stats/player";
import { PageBody } from "@/components/shell/page-header";
import { EmptyState, FormNotice, Panel, ResultChip } from "@/components/ui/panel";
import { AgentIcon, Comp, SmallSample } from "@/components/ui/agent";
import { buttonClass } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm";
import { AutoSubmitSelect } from "@/components/ui/auto-submit";
import { RadarChart } from "@/components/roster/radar-chart";
import { deletePlayer } from "../actions";

export const metadata: Metadata = { title: "Player" };

const SLOT_COLOR = { a: "#ff4655", b: "#13a0b2" } as const;
const TIER_CLASS = { good: "text-win", ok: "text-demo", low: "text-loss" } as const;
const TIER_LABEL = { good: "Strong", ok: "Average", low: "Below average" } as const;

type Params = {
  type?: string;
  a_map?: string;
  a_agent?: string;
  b_map?: string;
  b_agent?: string;
  map?: string;
  agent?: string;
  saved?: string;
};
const uuidOrNull = (v: string | string[] | undefined) => {
  const x = Array.isArray(v) ? v[v.length - 1] : v;
  return x && /^[0-9a-f-]{36}$/.test(x) ? x : null;
};
const SLOT_KEYS = ["a_map", "a_agent", "b_map", "b_agent"];

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { viewer, canEdit } = await sectionAccess("roster");
  const isMember = viewer.kind === "member";
  const data = await withActor(actorOf(viewer), async (tx) => ({
    catalog: await loadCatalog(tx),
    player: await getPlayer(tx, id),
    games: await playerGames(tx, id),
  }));
  if (!data.player) notFound();
  const { catalog, player: p } = data;
  const ownProfile = viewer.kind === "member" && viewer.playerId === p.id;

  const type: TypeFilter = sp.type === "practice" || sp.type === "officials" ? sp.type : "all";
  const games = byType(data.games, type);
  const defaults = defaultSlots(games);
  // A slot keeps "all" when the page was submitted with it empty; defaults apply on first visit only.
  const picked = "a_agent" in sp || "b_agent" in sp || "a_map" in sp || "b_map" in sp;
  const slotA = picked ? { map: uuidOrNull(sp.a_map), agent: uuidOrNull(sp.a_agent) } : defaults.a;
  const slotB = picked ? { map: uuidOrNull(sp.b_map), agent: uuidOrNull(sp.b_agent) } : defaults.b;
  const filterMap = uuidOrNull(sp.map);
  const filterAgent = uuidOrNull(sp.agent);
  const listed = slotGames(games, filterMap, filterAgent);

  const current: Record<string, string> = {
    type: type === "all" ? "" : type,
    a_map: slotA.map ?? "",
    a_agent: slotA.agent ?? "",
    b_map: slotB.map ?? "",
    b_agent: slotB.agent ?? "",
    map: filterMap ?? "",
    agent: filterAgent ?? "",
  };
  /** Links keep the current picks; slot keys stay even when empty ("all"), so defaults don't come back. */
  const href = (over: Record<string, string | null>, hash = "", resetSlots = false) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...over })) {
      const isSlot = SLOT_KEYS.includes(k);
      if (isSlot && resetSlots) continue;
      if (v || isSlot) q.set(k, v ?? "");
    }
    const s = q.toString();
    return `/roster/${p.id}${s ? `?${s}` : ""}${hash}`;
  };

  const role = [p.main_role_id, p.secondary_role_id]
    .map((r) => (r ? catalog.roleById.get(r)?.name : null))
    .filter(Boolean)
    .join(" / ");
  const total = perf(games);
  const byAgent = perfBy(games, "agent_id");
  const byMap = perfBy(games, "map_id");
  const agentsOf = (ids: string[]) =>
    ids.map((x) => catalog.agentById.get(x)).filter((a): a is NonNullable<typeof a> => Boolean(a));
  const others = catalog.players.filter((x) => x.active && x.id !== p.id);

  const slotLabel = (s: { map: string | null; agent: string | null }) =>
    `${s.agent ? (catalog.agentById.get(s.agent)?.name ?? "Agent") : "All agents"} (${s.map ? (catalog.mapById.get(s.map)?.name ?? "Map") : "all maps"})`;
  const perfA = perf(slotGames(games, slotA.map, slotA.agent));
  const perfB = perf(slotGames(games, slotB.map, slotB.agent));
  const radarValues = (x: Perf): Record<RadarKey, number | null> => ({
    acs: x.acs,
    kd: x.kd,
    kpr: x.kpr,
    winRate: x.winRate,
  });

  return (
    <>
      <header className="border-b-2 border-accent/80 px-5 pb-6 pt-6 sm:px-8">
        <Link href="/roster" className="inline-flex items-center gap-1 text-[14px] text-fog hover:text-bone">
          <ChevronLeft className="size-4" aria-hidden /> Roster
        </Link>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end">
          <div className="flex min-w-0 flex-1 items-end gap-5">
            <div className="relative shrink-0 pl-4">
              <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-accent" />
              <div className="size-24 overflow-hidden border border-line bg-raised sm:size-28">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.nickname} className="size-full object-cover" />
                ) : (
                  <span
                    aria-hidden
                    className="type-display grid size-full place-items-center text-[44px] font-extrabold text-line-strong"
                  >
                    {p.nickname.slice(0, 2)}
                  </span>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="type-display truncate text-[44px] font-extrabold text-bone sm:text-[60px]">
                  {p.nickname}
                </h1>
                {others.length ? (
                  <details className="group relative">
                    <summary
                      className="grid size-10 cursor-pointer list-none place-items-center text-accent hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden"
                      aria-label="Switch player"
                      title="Switch player"
                    >
                      <ChevronDown className="size-6 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <ul className="absolute left-0 top-full z-20 mt-1 max-h-80 min-w-[200px] overflow-auto border border-line-strong bg-raised py-1 shadow-xl">
                      {others.map((o) => (
                        <li key={o.id}>
                          <Link
                            href={`/roster/${o.id}${type === "all" ? "" : `?type=${type}`}`}
                            className="flex items-center gap-2 px-3 py-2 text-[14.5px] text-bone hover:bg-white/[0.05]"
                          >
                            {o.photo_url ? <img src={o.photo_url} alt="" className="size-6 object-cover" /> : null}
                            {o.nickname}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
              <p className="type-display text-[18px] font-bold uppercase tracking-[0.04em] text-accent">
                {role || "Role not set"}
                {!p.active ? <span className="ml-2 text-fog">· Inactive</span> : null}
              </p>
              {isMember && p.real_name ? <p className="text-[14px] text-fog">{p.real_name}</p> : null}
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <nav aria-label="Match type" className="flex">
              {(Object.keys(TYPE_FILTER_LABEL) as TypeFilter[]).map((t) => (
                <Link
                  key={t}
                  href={href({ type: t === "all" ? null : t }, "", true)}
                  aria-current={type === t ? "page" : undefined}
                  className={clsx(
                    "type-display h-11 border px-4 text-[15px] font-semibold uppercase leading-[42px] tracking-[0.04em] transition-colors",
                    type === t
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-raised text-bone hover:border-line-strong",
                  )}
                >
                  {TYPE_FILTER_LABEL[t]}
                </Link>
              ))}
            </nav>
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Link href={`/roster/${p.id}/edit`} className={buttonClass("secondary")}>
                  <Pencil className="size-4" aria-hidden /> Edit
                </Link>
                <ConfirmAction
                  action={deletePlayer}
                  hidden={{ id: p.id }}
                  label="Delete"
                  confirmLabel="Delete player"
                  question="This deletes their scoreboards too. Mark them inactive instead to keep history."
                />
              </div>
            ) : ownProfile ? (
              <Link href="/settings/account#player" className={buttonClass("secondary")}>
                <Pencil className="size-4" aria-hidden /> Edit my profile
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <PageBody>
        {sp.saved ? <FormNotice>Player saved.</FormNotice> : null}
        {games.length === 0 ? (
          <EmptyState
            title={data.games.length ? `No ${TYPE_FILTER_LABEL[type].toLowerCase()} matches yet` : "No scoreboards yet"}
          >
            {data.games.length
              ? "Switch the match type above to see the rest."
              : `Matches appear here once ${p.nickname}'s line is filled in a match scoreboard (Match Center → Add new match).`}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-5">
            <SummaryRow perf={total} />

            <Panel
              title="Performance & comparison"
              description="Pick a map and an agent on each side to compare them head to head. Use “All” to compare against the player's overall level."
              className="scroll-mt-4"
              id="compare"
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
                <div className="flex flex-col gap-4">
                  <SlotCard slot="a" pick={slotA} perf={perfA} catalog={catalog} games={games} keep={current} />
                  <SlotCard slot="b" pick={slotB} perf={perfB} catalog={catalog} games={games} keep={current} />
                </div>
                <div className="flex min-w-0 flex-col justify-center border-l-2 border-[#13a0b2]/70 bg-raised/40 px-3 py-5 sm:px-6">
                  <p className="type-display mx-auto mb-2 rounded-full border border-[#13a0b2]/70 px-5 py-1.5 text-[18px] font-bold uppercase tracking-[0.06em] text-[#5fd0dd]">
                    Head to head
                  </p>
                  <RadarChart
                    series={[
                      { label: slotLabel(slotA), color: SLOT_COLOR.a, values: radarValues(perfA) },
                      { label: slotLabel(slotB), color: SLOT_COLOR.b, values: radarValues(perfB) },
                    ]}
                  />
                  <p className="mt-2 text-center text-[12.5px] text-dim">
                    Outer ring: 350 ACS · 2.0 K/D · 1.2 kills per round · 100% wins.
                  </p>
                </div>
              </div>
            </Panel>

            <div className="grid gap-5 2xl:grid-cols-2">
              <PerfTable
                title="By agent"
                rows={byAgent.map((r) => {
                  const a = catalog.agentById.get(r.id);
                  return {
                    id: r.id,
                    perf: r.perf,
                    label: (
                      <span className="flex items-center gap-2">
                        {a ? <AgentIcon name={a.name} image={a.image} size={26} /> : null}
                        {a?.name ?? "Unknown"}
                      </span>
                    ),
                    href: href({ agent: r.id, map: null }, "#matches"),
                  };
                })}
              />
              <PerfTable
                title="By map"
                rows={byMap.map((r) => ({
                  id: r.id,
                  perf: r.perf,
                  label: catalog.mapById.get(r.id)?.name ?? "Unknown",
                  href: href({ map: r.id, agent: null }, "#matches"),
                }))}
              />
            </div>

            <AgentMapMatrix
              games={games}
              catalog={catalog}
              cellHref={(agent, map) => href({ a_agent: agent, a_map: map }, "#compare")}
            />

            <Panel
              id="matches"
              title="Matches played"
              description={`${listed.length} of ${games.length} ${games.length === 1 ? "match" : "matches"}${type === "all" ? "" : ` (${TYPE_FILTER_LABEL[type].toLowerCase()})`}. Click a row to open the match.`}
              className="scroll-mt-4"
              bodyClassName="p-0"
            >
              <form
                key={`${filterMap}-${filterAgent}-${type}`}
                method="get"
                action={`/roster/${p.id}#matches`}
                className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-3"
              >
                {Object.entries(current)
                  .filter(([k, v]) => (v || SLOT_KEYS.includes(k)) && k !== "map" && k !== "agent")
                  .map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))}
                <label className="flex min-w-[150px] flex-col gap-1">
                  <span className="text-[12.5px] text-fog">Map</span>
                  <AutoSubmitSelect name="map" defaultValue={filterMap ?? ""} className="field h-[42px] py-0">
                    <option value="">All maps</option>
                    {byMap.map((m) => (
                      <option key={m.id} value={m.id}>
                        {catalog.mapById.get(m.id)?.name}
                      </option>
                    ))}
                  </AutoSubmitSelect>
                </label>
                <label className="flex min-w-[150px] flex-col gap-1">
                  <span className="text-[12.5px] text-fog">Agent</span>
                  <AutoSubmitSelect name="agent" defaultValue={filterAgent ?? ""} className="field h-[42px] py-0">
                    <option value="">All agents</option>
                    {byAgent.map((a) => (
                      <option key={a.id} value={a.id}>
                        {catalog.agentById.get(a.id)?.name}
                      </option>
                    ))}
                  </AutoSubmitSelect>
                </label>
                <button type="submit" className="sr-only">
                  Apply
                </button>
                {filterMap || filterAgent ? (
                  <Link
                    href={href({ map: null, agent: null }, "#matches")}
                    className="grid h-[42px] place-items-center px-2 text-[14px] text-fog hover:text-bone"
                  >
                    Clear
                  </Link>
                ) : null}
                {listed.length && (filterMap || filterAgent) ? (
                  <p className="ml-auto self-center text-[13.5px] text-fog">
                    {fmt.pct(perf(listed).winRate)} wins · {fmt.int(perf(listed).acs)} ACS ·{" "}
                    {fmt.ratio(perf(listed).kd)} K/D
                  </p>
                ) : null}
              </form>
              <MatchTable games={listed} catalog={catalog} />
            </Panel>
          </div>
        )}
        <div className="mt-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Agent pool">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-[13px] text-fog">Main agents</p>
                  {p.main_agent_ids.length ? (
                    <>
                      <Comp agents={agentsOf(p.main_agent_ids)} size={36} />
                      <p className="mt-1 text-[13px] text-fog">
                        {agentsOf(p.main_agent_ids)
                          .map((a) => a.name)
                          .join(" · ")}
                      </p>
                    </>
                  ) : (
                    <p className="text-dim">Not set</p>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-[13px] text-fog">Secondary agents</p>
                  {p.secondary_agent_ids.length ? (
                    <>
                      <Comp agents={agentsOf(p.secondary_agent_ids)} size={36} />
                      <p className="mt-1 text-[13px] text-fog">
                        {agentsOf(p.secondary_agent_ids)
                          .map((a) => a.name)
                          .join(" · ")}
                      </p>
                    </>
                  ) : (
                    <p className="text-dim">Not set</p>
                  )}
                </div>
              </div>
            </Panel>
            {isMember && (p.strengths || p.weaknesses) ? (
              <Panel title="Scouting report" description="From the staff.">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-[13px] text-fog">Strengths</dt>
                    <dd className="whitespace-pre-wrap text-bone">{p.strengths ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-fog">Weaknesses</dt>
                    <dd className="whitespace-pre-wrap text-bone">{p.weaknesses ?? "—"}</dd>
                  </div>
                </dl>
              </Panel>
            ) : null}
          </div>
        </div>
      </PageBody>
    </>
  );
}

function Stat({
  label,
  value,
  tierKey,
  raw,
  wide,
}: {
  label: string;
  value: string;
  tierKey?: RadarKey;
  raw?: number | null;
  wide?: boolean;
}) {
  const t = tierKey ? tier(tierKey, raw ?? null) : null;
  return (
    <div
      className={clsx("bg-ink/70 px-3 py-3 text-center", wide && "col-span-2")}
      title={t ? TIER_LABEL[t] : undefined}
    >
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-fog">{label}</p>
      <p className={clsx("num text-[28px] font-semibold leading-tight", t ? TIER_CLASS[t] : "text-bone")}>{value}</p>
    </div>
  );
}

function SummaryRow({ perf: x }: { perf: Perf }) {
  const items: [string, string, RadarKey?, (number | null)?][] = [
    ["Matches", String(x.games)],
    ["Win rate", fmt.pct(x.winRate), "winRate", x.winRate],
    ["ACS", fmt.int(x.acs), "acs", x.acs],
    ["K/D", fmt.ratio(x.kd), "kd", x.kd],
    ["KPR", fmt.ratio(x.kpr), "kpr", x.kpr],
    ["ADR", fmt.int(x.adr)],
    ["HS%", fmt.hs(x.hs)],
    ["FK / FD", `${x.firstKills} / ${x.firstDeaths}`],
  ];
  return (
    <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4 xl:grid-cols-8">
      {items.map(([label, value, key, raw]) => (
        <div key={label} className="bg-panel">
          <Stat label={label} value={value} tierKey={key} raw={raw} />
        </div>
      ))}
    </div>
  );
}

function SlotCard({
  slot,
  pick,
  perf: x,
  catalog,
  games,
  keep,
}: {
  slot: "a" | "b";
  pick: { map: string | null; agent: string | null };
  perf: Perf;
  catalog: Catalog;
  games: PlayerGame[];
  keep: Record<string, string>;
}) {
  const color = SLOT_COLOR[slot];
  const o = slot === "a" ? "b" : "a";
  const agent = pick.agent ? catalog.agentById.get(pick.agent) : null;
  // Only offer what the player has actually played (in the chosen map, for agents).
  const maps = perfBy(slotGames(games, null, pick.agent), "map_id");
  const agents = perfBy(slotGames(games, pick.map, null), "agent_id");
  if (pick.map && !maps.some((m) => m.id === pick.map)) maps.unshift({ id: pick.map, perf: perf([]) });
  if (pick.agent && !agents.some((a) => a.id === pick.agent)) agents.unshift({ id: pick.agent, perf: perf([]) });
  const selectClass = "field h-10 w-full py-0 text-[15px] font-semibold uppercase tracking-[0.03em]";

  return (
    <div className="border-l-2 bg-raised/40 p-4" style={{ borderColor: color }}>
      {/* Keyed so the selects show the new pick after client-side navigation */}
      <form key={`${pick.map}-${pick.agent}`} method="get" action="#compare" className="flex items-start gap-3">
        {Object.entries(keep)
          .filter(([k, v]) => !k.startsWith(`${slot}_`) && (v || k.startsWith(`${o}_`)))
          .map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label className="sr-only" htmlFor={`${slot}-map`}>
            Map for {slot === "a" ? "the first" : "the second"} pick
          </label>
          <AutoSubmitSelect
            id={`${slot}-map`}
            name={`${slot}_map`}
            defaultValue={pick.map ?? ""}
            className={selectClass}
            style={{ color, borderColor: `${color}99` }}
          >
            <option value="">All maps</option>
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {catalog.mapById.get(m.id)?.name}
              </option>
            ))}
          </AutoSubmitSelect>
          <label className="sr-only" htmlFor={`${slot}-agent`}>
            Agent for {slot === "a" ? "the first" : "the second"} pick
          </label>
          <AutoSubmitSelect
            id={`${slot}-agent`}
            name={`${slot}_agent`}
            defaultValue={pick.agent ?? ""}
            className={selectClass}
            style={{ color, borderColor: `${color}99` }}
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {catalog.agentById.get(a.id)?.name}
              </option>
            ))}
          </AutoSubmitSelect>
          <button type="submit" className="sr-only">
            Compare
          </button>
        </div>
        <div className="size-14 shrink-0 overflow-hidden border border-line bg-ink">
          {agent?.image ? <img src={agent.image} alt={agent.name} className="size-full object-cover" /> : null}
        </div>
      </form>
      <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-[13px] text-fog">
        <span>
          Sample size:{" "}
          <span className="font-semibold text-bone">
            {x.games} {x.games === 1 ? "match" : "matches"}
          </span>
        </span>
        {x.games > 0 && x.games < MIN_SAMPLE ? <SmallSample played={x.games} /> : null}
      </div>
      {x.games ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="ACS" value={fmt.int(x.acs)} tierKey="acs" raw={x.acs} />
          <Stat label="K/D ratio" value={fmt.ratio(x.kd)} tierKey="kd" raw={x.kd} />
          <Stat label="Win rate %" value={fmt.pct(x.winRate)} tierKey="winRate" raw={x.winRate} />
          <Stat label="Kills per round" value={fmt.ratio(x.kpr)} tierKey="kpr" raw={x.kpr} />
        </div>
      ) : (
        <p className="mt-3 text-[14px] text-dim">No matches with this map and agent.</p>
      )}
    </div>
  );
}

function PerfTable({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; perf: Perf; label: React.ReactNode; href: string }[];
}) {
  return (
    <Panel title={title} description="Click a row to list those matches." bodyClassName="overflow-x-auto p-0">
      <table className="w-full min-w-[520px] text-left">
        <thead className="text-[12.5px] text-fog">
          <tr className="border-b border-line">
            <th className="px-5 py-2.5 font-medium">{title === "By agent" ? "Agent" : "Map"}</th>
            <th className="px-2 py-2.5 text-right font-medium">Matches</th>
            <th className="px-2 py-2.5 text-right font-medium">Win %</th>
            <th className="px-2 py-2.5 text-right font-medium">ACS</th>
            <th className="px-2 py-2.5 text-right font-medium">K/D</th>
            <th className="px-2 py-2.5 text-right font-medium">KPR</th>
            <th className="px-5 py-2.5 text-right font-medium">ADR</th>
          </tr>
        </thead>
        <tbody className="num text-[16px] text-bone">
          {rows.map((r) => (
            <tr key={r.id} className="group relative border-t border-line first:border-t-0 hover:bg-white/[0.025]">
              <td className="px-5 py-2 font-sans text-[14.5px]">
                <Link href={r.href} className="after:absolute after:inset-0">
                  {r.label}
                </Link>
              </td>
              <td className="px-2 py-2 text-right">
                {r.perf.games}
                {r.perf.games < MIN_SAMPLE ? <span className="sr-only"> (small sample)</span> : null}
              </td>
              <td className={clsx("px-2 py-2 text-right", r.perf.games < MIN_SAMPLE && "text-fog")}>
                {fmt.pct(r.perf.winRate)}
              </td>
              <td className="px-2 py-2 text-right">{fmt.int(r.perf.acs)}</td>
              <td className="px-2 py-2 text-right">{fmt.ratio(r.perf.kd)}</td>
              <td className="px-2 py-2 text-right">{fmt.ratio(r.perf.kpr)}</td>
              <td className="px-5 py-2 text-right">{fmt.int(r.perf.adr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function AgentMapMatrix({
  games,
  catalog,
  cellHref,
}: {
  games: PlayerGame[];
  catalog: Catalog;
  cellHref: (agent: string, map: string) => string;
}) {
  const agents = perfBy(games, "agent_id");
  const maps = perfBy(games, "map_id");
  if (agents.length < 1 || maps.length < 1) return null;
  return (
    <Panel
      title="Agent × map"
      description="Average ACS for each agent on each map, with the number of matches. Click a cell to compare it above."
      bodyClassName="overflow-x-auto p-0"
    >
      <table className="w-full text-left" style={{ minWidth: 160 + maps.length * 92 }}>
        <thead className="text-[12.5px] text-fog">
          <tr className="border-b border-line">
            <th className="px-5 py-2.5 font-medium">Agent</th>
            {maps.map((m) => (
              <th key={m.id} className="px-2 py-2.5 text-center font-medium">
                {catalog.mapById.get(m.id)?.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => {
            const ag = catalog.agentById.get(a.id);
            return (
              <tr key={a.id} className="border-t border-line first:border-t-0">
                <td className="px-5 py-2">
                  <span className="flex items-center gap-2 text-[14.5px] text-bone">
                    {ag ? <AgentIcon name={ag.name} image={ag.image} size={24} /> : null}
                    {ag?.name ?? "Unknown"}
                  </span>
                </td>
                {maps.map((m) => {
                  const cell = perf(slotGames(games, m.id, a.id));
                  return (
                    <td key={m.id} className="px-1 py-1 text-center">
                      {cell.games ? (
                        <Link
                          href={cellHref(a.id, m.id)}
                          className={clsx(
                            "block px-2 py-1.5 transition-colors hover:bg-white/[0.05]",
                            cell.games < MIN_SAMPLE ? "text-fog" : "text-bone",
                          )}
                          title={`${ag?.name} on ${catalog.mapById.get(m.id)?.name}: ${cell.games} matches, ${fmt.pct(cell.winRate)} wins`}
                        >
                          <span className="num block text-[17px] leading-tight">{fmt.int(cell.acs)}</span>
                          <span className="block text-[11.5px] text-dim">{cell.games}×</span>
                        </Link>
                      ) : (
                        <span className="text-dim">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function MatchTable({ games, catalog }: { games: PlayerGame[]; catalog: Catalog }) {
  if (!games.length) return <p className="px-5 py-4 text-fog">No matches with these filters.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left">
        <thead className="text-[12.5px] text-fog">
          <tr className="border-b border-line">
            <th className="px-5 py-2.5 font-medium">Date</th>
            <th className="px-2 py-2.5 font-medium">Type</th>
            <th className="px-2 py-2.5 font-medium">Map</th>
            <th className="px-2 py-2.5 font-medium">Opponent</th>
            <th className="px-2 py-2.5 font-medium">Agent</th>
            <th className="px-2 py-2.5 font-medium">Result</th>
            <th className="px-2 py-2.5 text-right font-medium">K / D / A</th>
            <th className="px-2 py-2.5 text-right font-medium">ACS</th>
            <th className="px-2 py-2.5 text-right font-medium">KPR</th>
            <th className="px-2 py-2.5 text-right font-medium">ADR</th>
            <th className="px-2 py-2.5 text-right font-medium">HS%</th>
            <th className="px-5 py-2.5 text-right font-medium">FK / FD</th>
          </tr>
        </thead>
        <tbody className="text-[14.5px] text-bone">
          {games.map((g) => {
            const ag = g.agent_id ? catalog.agentById.get(g.agent_id) : null;
            const rounds = g.our_score + g.opp_score;
            return (
              <tr key={g.match_id} className="relative border-t border-line first:border-t-0 hover:bg-white/[0.025]">
                <td className="whitespace-nowrap px-5 py-2">
                  <Link href={`/matches/${g.match_id}`} className="after:absolute after:inset-0">
                    {formatDay(g.played_on, { month: "short", day: "numeric", year: "2-digit" })}
                  </Link>
                </td>
                <td className="px-2 py-2 text-fog">{MATCH_TYPE_LABEL[g.match_type]}</td>
                <td className="px-2 py-2">{catalog.mapById.get(g.map_id)?.name}</td>
                <td className="max-w-[160px] truncate px-2 py-2">{catalog.opponentById.get(g.opponent_id)?.name}</td>
                <td className="px-2 py-2">
                  <span className="flex items-center gap-2">
                    {ag ? <AgentIcon name={ag.name} image={ag.image} size={22} /> : null}
                    {ag?.name ?? "—"}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <span className="flex items-center gap-2">
                    <ResultChip result={g.result} size="sm" />
                    <span className="num text-[16px]">
                      {g.our_score}–{g.opp_score}
                    </span>
                  </span>
                </td>
                <td className="num px-2 py-2 text-right text-[16px]">
                  {g.kills ?? "—"} / {g.deaths ?? "—"} / {g.assists ?? "—"}
                </td>
                <td className="num px-2 py-2 text-right text-[16px]">{g.acs ?? "—"}</td>
                <td className="num px-2 py-2 text-right text-[16px]">
                  {g.kills !== null && rounds ? (g.kills / rounds).toFixed(2) : "—"}
                </td>
                <td className="num px-2 py-2 text-right text-[16px]">{g.adr !== null ? Math.round(g.adr) : "—"}</td>
                <td className="num px-2 py-2 text-right text-[16px]">
                  {g.hs_pct !== null ? `${Math.round(g.hs_pct)}%` : "—"}
                </td>
                <td className="num px-5 py-2 text-right text-[16px]">
                  {g.first_kills ?? "—"} / {g.first_deaths ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
