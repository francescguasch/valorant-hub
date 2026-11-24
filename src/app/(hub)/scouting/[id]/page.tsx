import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { actorOf, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { compAgents, loadCatalog } from "@/lib/data/catalog";
import { listMatches } from "@/lib/data/matches";
import { compStats, formatDiff, formatPct, mapStats, recentFirst, record, seriesResults } from "@/lib/stats/matches";
import { formatDay } from "@/lib/format";
import { PageBody } from "@/components/shell/page-header";
import { DemoBadge, EmptyState, Panel, ResultChip } from "@/components/ui/panel";
import { Comp, RateBar, SmallSample } from "@/components/ui/agent";
import { MatchList } from "@/components/matches/match-list";
import { ScoutingNotesForm } from "../notes-form";

export const metadata: Metadata = { title: "Opponent" };

export default async function OpponentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { viewer, canEdit } = await sectionAccess("scouting");
  const data = await withActor(actorOf(viewer), async (tx) => ({
    catalog: await loadCatalog(tx),
    matches: await listMatches(tx, { opponent: id }),
    notes: (await tx<{ notes: string | null }[]>`select notes from public.opponent_notes where opponent_id = ${id}`)[0]?.notes ?? null,
  }));
  const opp = data.catalog.opponentById.get(id);
  if (!opp) notFound();
  const { catalog, matches } = data;
  const r = record(matches);
  const last = recentFirst(matches)[0];
  const maps = mapStats(matches);
  const ours = compStats(matches, "ours");
  const theirs = compStats(matches, "theirs");
  const series = seriesResults(matches);

  const stats: [string, string][] = [
    ["Matches", String(r.played)],
    ["Record", `${r.wins}W ${r.losses}L${r.draws ? ` ${r.draws}D` : ""}`],
    ["Win rate", formatPct(r.winRate)],
    ["Rounds won – lost", `${r.roundsWon}–${r.roundsLost}`],
    ["Average round difference", r.played ? formatDiff(Math.round((r.roundDiff / r.played) * 10) / 10) : "—"],
    ["Last meeting", last ? formatDay(last.played_on, { month: "short", day: "numeric", year: "numeric" }) : "—"],
  ];

  return (
    <>
      <header className="border-b border-line px-5 pb-6 pt-6 sm:px-8">
        <Link href="/scouting" className="inline-flex items-center gap-1 text-[14px] text-fog hover:text-bone">
          <ChevronLeft className="size-4" aria-hidden /> Opponent Scouting
        </Link>
        <h1 className="type-display mt-4 flex flex-wrap items-center gap-3 text-[44px] font-extrabold text-bone sm:text-[56px]">
          {opp.name} {opp.is_demo ? <DemoBadge /> : null}
        </h1>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[12.5px] text-fog">{k}</dt>
              <dd className="num text-[28px] font-semibold text-bone">{v}</dd>
            </div>
          ))}
        </dl>
        {r.played > 0 && r.smallSample ? <div className="mt-2"><SmallSample played={r.played} /></div> : null}
      </header>
      <PageBody>
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Scouting notes" className="xl:col-span-2">
            {canEdit ? (
              <ScoutingNotesForm opponentId={opp.id} notes={data.notes ?? ""} />
            ) : data.notes ? (
              <p className="whitespace-pre-wrap text-bone">{data.notes}</p>
            ) : (
              <p className="text-dim">No scouting notes yet.</p>
            )}
          </Panel>

          {matches.length === 0 ? (
            <div className="xl:col-span-2">
              <EmptyState title="No matches against this team yet">Write the scouting notes above to prepare the first meeting.</EmptyState>
            </div>
          ) : (
            <>
              <Panel title="Maps against them" bodyClassName="p-0">
                <table className="w-full text-left">
                  <thead className="text-[12.5px] text-fog">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Map</th>
                      <th className="px-3 py-2.5 font-medium">Played</th>
                      <th className="px-3 py-2.5 font-medium">Won</th>
                      <th className="px-3 py-2.5 font-medium">Lost</th>
                      <th className="w-[38%] px-5 py-2.5 font-medium">Win rate</th>
                    </tr>
                  </thead>
                  <tbody className="num text-[17px] text-bone">
                    {maps.map((s) => (
                      <tr key={s.mapId} className="border-t border-line">
                        <td className="px-5 py-2.5 font-sans text-[15px] font-semibold">{catalog.mapById.get(s.mapId)?.name}</td>
                        <td className="px-3 py-2.5">{s.played}</td>
                        <td className="px-3 py-2.5">{s.wins}</td>
                        <td className="px-3 py-2.5">{s.losses}</td>
                        <td className="px-5 py-2.5">
                          <RateBar value={s.winRate} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>

              <Panel title="Series" bodyClassName="p-0">
                {series.length ? (
                  <ul className="divide-y divide-line">
                    {series.map((s) => (
                      <li key={s.seriesId} className="flex items-center gap-3 px-5 py-3">
                        <ResultChip result={s.result} size="sm" />
                        <span className="flex-1 text-bone">
                          {s.format ?? "Series"} · {formatDay(s.playedOn)}
                        </span>
                        <span className="num text-[20px] text-bone">
                          {s.mapsWon}–{s.mapsLost}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-4 text-dim">No series recorded. Add a series id to group maps.</p>
                )}
              </Panel>

              <CompPanel title="Your compositions against them" comps={ours} catalog={catalog} />
              <CompPanel title="Their compositions against you" comps={theirs} catalog={catalog} note="Your record when they played it." />

              <div className="xl:col-span-2">
                <h2 className="type-display mb-3 text-[19px] font-bold">Results history</h2>
                <MatchList matches={matches} catalog={catalog} showOpponent={false} />
              </div>
            </>
          )}
        </div>
      </PageBody>
    </>
  );
}

function CompPanel({
  title,
  comps,
  catalog,
  note,
}: {
  title: string;
  comps: ReturnType<typeof compStats>;
  catalog: Awaited<ReturnType<typeof loadCatalog>>;
  note?: string;
}) {
  return (
    <Panel title={title} description={note} bodyClassName="p-0">
      <ul className="divide-y divide-line">
        {comps.map((c) => (
          <li key={c.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <Comp agents={compAgents(catalog, c.agentIds)} size={28} />
            <span className="flex items-center gap-3">
              {c.smallSample ? <SmallSample played={c.played} /> : null}
              <span className="num text-[17px] text-bone">
                {c.wins}W {c.losses}L{c.draws ? ` ${c.draws}D` : ""} · {formatPct(c.winRate)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
