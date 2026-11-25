import Link from "next/link";
import { Plus } from "lucide-react";
import { sectionAccess } from "@/lib/auth/viewer";
import { loadOverview } from "@/lib/data/overview";
import { currentStreak, formatDiff, formatPct, lastResults, recentFirst, record, sideStats } from "@/lib/stats/matches";
import { formatDay } from "@/lib/format";
import { Hero } from "@/components/overview/hero";
import { FormChart, type FormPoint } from "@/components/overview/form-chart";
import {
  AgentsMostUsed,
  Compositions,
  MapPerformance,
  RecentMatches,
  UpcomingPractice,
} from "@/components/overview/sections";
import { EmptyState, Panel } from "@/components/ui/panel";
import { buttonClass } from "@/components/ui/button";

const TYPE_LABEL = { scrim: "Scrim", official: "Official", tournament: "Tournament" } as const;

/** Round totals and T/CT side round win rate across all recorded matches. */
function SideSummary({ matches }: { matches: Parameters<typeof record>[0] }) {
  const r = record(matches);
  const sides = sideStats(matches);
  const items = [
    { label: "Rounds won – lost", value: `${r.roundsWon}–${r.roundsLost}` },
    { label: "Round difference per match", value: formatDiff(Math.round((r.roundDiff / r.played) * 10) / 10) },
    { label: "T side rounds won", value: formatPct(sides.t.rate), note: `${sides.t.won} of ${sides.t.played}` },
    { label: "CT side rounds won", value: formatPct(sides.ct.rate), note: `${sides.ct.won} of ${sides.ct.played}` },
  ];
  return (
    <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 md:grid-cols-4">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-[12.5px] text-fog">{i.label}</dt>
          <dd className="num text-[28px] font-semibold leading-tight text-bone">{i.value}</dd>
          {i.note ? <dd className="text-[12px] text-dim">{i.note} rounds</dd> : null}
        </div>
      ))}
    </dl>
  );
}

export default async function OverviewPage() {
  const { viewer, settings, canEdit } = await sectionAccess("overview");
  const data = await loadOverview(viewer);
  const matches = data.matches;
  const teamRecord = record(matches);
  const isMember = viewer.kind === "member";

  const formPoints: FormPoint[] = recentFirst(matches)
    .slice(0, 20)
    .reverse()
    .map((m) => ({
      id: m.id,
      date: formatDay(m.played_on),
      opponent: data.opponentById.get(m.opponent_id)?.name ?? "Unknown",
      map: data.mapById.get(m.map_id)?.name ?? "",
      score: `${m.our_score}–${m.opp_score}`,
      diff: m.round_diff,
      result: m.result,
      type: TYPE_LABEL[m.match_type],
    }));

  return (
    <>
      <Hero settings={settings} record={teamRecord} streak={currentStreak(matches)} lastFive={lastResults(matches, 5)} />

      <div className="grid gap-5 px-5 py-6 sm:px-8 sm:py-8 xl:grid-cols-12 [&>*]:min-w-0">
        {matches.length === 0 ? (
          <div className="xl:col-span-12">
            <EmptyState
              title="No matches recorded yet"
              action={
                canEdit ? (
                  <Link href="/matches" className={buttonClass("primary")}>
                    <Plus className="size-4" aria-hidden /> Add new match
                  </Link>
                ) : null
              }
            >
              Form, map win rates and composition stats appear here as soon as the first scrim or official match is
              added in Match Center. Nothing is estimated: every number comes from recorded matches.
            </EmptyState>
          </div>
        ) : (
          <>
            <Panel
              title="Recent form"
              description="Round difference per match, oldest to newest."
              className="xl:col-span-8"
            >
              <FormChart points={formPoints} />
              <SideSummary matches={matches} />
            </Panel>
            <div className="xl:col-span-4">
              <RecentMatches data={data} matches={matches} />
            </div>
            <div className="xl:col-span-7">
              <MapPerformance data={data} matches={matches} />
            </div>
            <div className="flex flex-col gap-5 xl:col-span-5">
              <Compositions data={data} matches={matches} />
              <AgentsMostUsed data={data} matches={matches} />
            </div>
          </>
        )}

        {isMember || data.practiceVisible ? (
          <div className="xl:col-span-12">
            <UpcomingPractice data={data} timezone={settings.timezone} canEdit={canEdit} />
          </div>
        ) : null}
      </div>
    </>
  );
}
