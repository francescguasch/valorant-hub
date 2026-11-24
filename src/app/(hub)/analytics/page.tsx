import type { Metadata } from "next";
import { actorOf, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { compAgents, loadCatalog } from "@/lib/data/catalog";
import { hasFilters, listMatches, parseFilters, playerAggregates, seasonsAndCompetitions } from "@/lib/data/matches";
import {
  MIN_SAMPLE,
  bestMaps,
  compStats,
  formatDiff,
  formatPct,
  mapStats,
  matchupStats,
  record,
  roundTypeMetrics,
  sideStats,
  type RateMetric,
} from "@/lib/stats/matches";
import { MATCH_TYPES } from "@/lib/constants";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { FilterBar, FilterDate, FilterSelect } from "@/components/ui/filter-bar";
import { EmptyState, Panel } from "@/components/ui/panel";
import { Comp, RateBar, SmallSample } from "@/components/ui/agent";

export const metadata: Metadata = { title: "Team Analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const { viewer } = await sectionAccess("analytics");
  const { catalog, matches, meta, players } = await withActor(actorOf(viewer), async (tx) => ({
    catalog: await loadCatalog(tx),
    matches: await listMatches(tx, filters),
    meta: await seasonsAndCompetitions(tx),
    players: await playerAggregates(tx, filters),
  }));
  const r = record(matches);
  const sides = sideStats(matches);
  const maps = mapStats(matches);
  const comps = compStats(matches).slice(0, 10);
  const matchups = matchupStats(matches).slice(0, 12);
  const metrics = roundTypeMetrics(matches);

  return (
    <>
      <PageHeader
        title="Team Analytics"
        description={`Maps, compositions and matchups from your recorded matches. Percentages based on fewer than ${MIN_SAMPLE} matches are marked as small samples.`}
      />
      <PageBody>
        <FilterBar resetHref="/analytics" active={hasFilters(filters)}>
          <FilterSelect label="Season" name="season" value={filters.season} options={meta.seasons.map((s) => ({ value: s, label: s }))} />
          <FilterSelect label="Type" name="type" value={filters.type} options={MATCH_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
          <FilterSelect label="Map" name="map" value={filters.map} options={catalog.maps.map((m) => ({ value: m.id, label: m.name }))} />
          <FilterSelect label="Opponent" name="opponent" value={filters.opponent} options={catalog.opponents.map((o) => ({ value: o.id, label: o.name }))} />
          <FilterSelect label="Competition" name="competition" value={filters.competition} options={meta.competitions.map((c) => ({ value: c, label: c }))} />
          <FilterDate label="From" name="from" value={filters.from} />
          <FilterDate label="To" name="to" value={filters.to} />
        </FilterBar>

        {matches.length === 0 ? (
          <EmptyState title={hasFilters(filters) ? "No matches match these filters" : "No matches recorded yet"}>
            Analytics are calculated from Match Center. Nothing is shown until there is real data.
          </EmptyState>
        ) : (
          <div className="grid gap-5 xl:grid-cols-12">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6 xl:col-span-12">
              {[
                ["Matches", String(r.played)],
                ["Record", `${r.wins}W ${r.losses}L${r.draws ? ` ${r.draws}D` : ""}`],
                ["Win rate", formatPct(r.winRate)],
                ["Round difference", formatDiff(r.roundDiff)],
                ["T side rounds won", formatPct(sides.t.rate)],
                ["CT side rounds won", formatPct(sides.ct.rate)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[12.5px] text-fog">{k}</dt>
                  <dd className="num text-[30px] font-semibold text-bone">{v}</dd>
                </div>
              ))}
            </dl>

            <Panel title="Maps" description="Win rate and rounds won on each side." className="xl:col-span-12" bodyClassName="overflow-x-auto p-0">
              <table className="w-full min-w-[760px] text-left">
                <thead className="text-[12.5px] text-fog">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Map</th>
                    <th className="px-3 py-2.5 font-medium">Matches</th>
                    <th className="px-3 py-2.5 font-medium">Record</th>
                    <th className="w-[26%] px-3 py-2.5 font-medium">Win rate</th>
                    <th className="px-3 py-2.5 font-medium">T rounds</th>
                    <th className="px-3 py-2.5 font-medium">CT rounds</th>
                    <th className="px-5 py-2.5 font-medium">Round diff</th>
                  </tr>
                </thead>
                <tbody className="num text-[17px] text-bone">
                  {maps.map((s) => (
                    <tr key={s.mapId} className="border-t border-line">
                      <td className="px-5 py-2.5 font-sans">
                        <span className="block text-[15px] font-semibold">{catalog.mapById.get(s.mapId)?.name}</span>
                        {s.smallSample ? <SmallSample played={s.played} /> : null}
                      </td>
                      <td className="px-3 py-2.5">{s.played}</td>
                      <td className="px-3 py-2.5">
                        {s.wins}W {s.losses}L{s.draws ? ` ${s.draws}D` : ""}
                      </td>
                      <td className="px-3 py-2.5">
                        <RateBar value={s.winRate} />
                      </td>
                      <td className="px-3 py-2.5">
                        {formatPct(s.sides.t.rate)} <span className="text-[13px] text-dim">{s.sides.t.won}/{s.sides.t.played}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        {formatPct(s.sides.ct.rate)} <span className="text-[13px] text-dim">{s.sides.ct.won}/{s.sides.ct.played}</span>
                      </td>
                      <td className="px-5 py-2.5">{formatDiff(s.roundDiff)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            <Panel title="Compositions" description="Your lineups, regardless of agent order." className="xl:col-span-7" bodyClassName="p-0">
              <ul className="divide-y divide-line">
                {comps.map((c) => {
                  const best = bestMaps(matches, c.key);
                  return (
                    <li key={c.key} className="grid gap-2 px-5 py-3.5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4">
                      <Comp agents={compAgents(catalog, c.agentIds)} size={30} />
                      <div className="min-w-0 text-[13.5px] text-fog">
                        <span className="num text-[16px] text-bone">
                          {c.wins}W {c.losses}L{c.draws ? ` ${c.draws}D` : ""}
                        </span>{" "}
                        · {c.played} played
                        {best.length ? ` · best on ${best.map((b) => catalog.mapById.get(b.mapId)?.name).join(", ")}` : ""}
                        {c.smallSample ? (
                          <span className="ml-2">
                            <SmallSample played={c.played} />
                          </span>
                        ) : null}
                      </div>
                      <p className="num text-[26px] font-semibold text-bone">{formatPct(c.winRate)}</p>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <Panel title="Round types" description="Only matches where each number was recorded count." className="xl:col-span-5">
              <dl className="grid gap-5">
                <Metric label="Pistol round win rate" m={metrics.pistol} />
                <Metric label="Anti-eco conversion" m={metrics.antiEco} />
                <Metric label="Bonus round conversion" m={metrics.bonus} />
                <Metric label="First blood conversion" m={metrics.firstBlood} />
              </dl>
            </Panel>

            <Panel
              title="Composition matchups"
              description="Your composition against theirs. Use it to choose lineups, with care when the sample is small."
              className="xl:col-span-12"
              bodyClassName="overflow-x-auto p-0"
            >
              <table className="w-full min-w-[760px] text-left">
                <thead className="text-[12.5px] text-fog">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Your composition</th>
                    <th className="px-3 py-2.5 font-medium">Against</th>
                    <th className="px-3 py-2.5 font-medium">Matches</th>
                    <th className="px-3 py-2.5 font-medium">Record</th>
                    <th className="px-5 py-2.5 font-medium">Win rate</th>
                  </tr>
                </thead>
                <tbody className="num text-[17px] text-bone">
                  {matchups.map((mu) => (
                    <tr key={mu.key} className="border-t border-line">
                      <td className="px-5 py-2.5">
                        <Comp agents={compAgents(catalog, mu.ourKey.split("."))} size={26} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Comp agents={compAgents(catalog, mu.oppKey.split("."))} size={26} />
                      </td>
                      <td className="px-3 py-2.5">{mu.played}</td>
                      <td className="px-3 py-2.5">
                        {mu.wins}W {mu.losses}L{mu.draws ? ` ${mu.draws}D` : ""}
                      </td>
                      <td className="px-5 py-2.5">
                        {formatPct(mu.winRate)} {mu.smallSample ? <SmallSample played={mu.played} /> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            <Panel title="Players" description="From the match scoreboards you've entered." className="xl:col-span-12" bodyClassName="overflow-x-auto p-0">
              {players.length === 0 ? (
                <p className="px-5 py-4 text-dim">No scoreboards entered for these matches yet. Add them in each match&apos;s form.</p>
              ) : (
                <table className="w-full min-w-[760px] text-left">
                  <thead className="text-[12.5px] text-fog">
                    <tr>
                      {["Player", "Maps", "K/D", "K / D / A", "ACS", "ADR", "HS%", "FK / FD"].map((h) => (
                        <th key={h} className="px-5 py-2.5 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="num text-[17px] text-bone">
                    {players.map((p) => (
                      <tr key={p.player_id} className="border-t border-line">
                        <td className="px-5 py-2.5 font-sans text-[15px] font-semibold">{catalog.playerById.get(p.player_id)?.nickname}</td>
                        <td className="px-5 py-2.5">{p.maps}</td>
                        <td className="px-5 py-2.5">{p.deaths ? (p.kills / p.deaths).toFixed(2) : "—"}</td>
                        <td className="px-5 py-2.5">
                          {p.kills} / {p.deaths} / {p.assists}
                        </td>
                        <td className="px-5 py-2.5">{p.acs ?? "—"}</td>
                        <td className="px-5 py-2.5">{p.adr ?? "—"}</td>
                        <td className="px-5 py-2.5">{p.hs_pct !== null ? `${p.hs_pct}%` : "—"}</td>
                        <td className="px-5 py-2.5">
                          {p.first_kills} / {p.first_deaths}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>
        )}
      </PageBody>
    </>
  );
}

function Metric({ label, m }: { label: string; m: RateMetric }) {
  return (
    <div>
      <dt className="mb-1.5 flex items-baseline justify-between gap-3 text-[14px] text-bone">
        {label}
        <span className="text-[12.5px] text-dim">
          {m.matches ? `${m.won} of ${m.total} · ${m.matches} match${m.matches === 1 ? "" : "es"}` : "Not recorded yet"}
        </span>
      </dt>
      <dd>{m.matches ? <RateBar value={m.rate} /> : <span className="text-[13px] text-dim">Add it in the match form to see this.</span>}</dd>
      {m.matches > 0 && m.matches < MIN_SAMPLE ? (
        <dd className="mt-1">
          <SmallSample played={m.matches} />
        </dd>
      ) : null}
    </div>
  );
}
