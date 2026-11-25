/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import type { OverviewData } from "@/lib/data/overview";
import {
  agentUsage,
  compStats,
  formatDiff,
  formatPct,
  lastResults,
  mapStats,
  strongestAndWeakest,
  type MatchRow,
} from "@/lib/stats/matches";
import { formatDateTime, formatDay, formatDuration } from "@/lib/format";
import { DemoBadge, EmptyState, Panel, ResultChip } from "../ui/panel";
import { Comp, RateBar, SmallSample } from "../ui/agent";
import { buttonClass } from "../ui/button";

const TYPE_LABEL = { scrim: "Scrim", official: "Official", tournament: "Tournament" } as const;

export function RecentMatches({ data, matches }: { data: OverviewData; matches: MatchRow[] }) {
  const rows = lastResults(matches, 6);
  return (
    <Panel
      title="Recent matches"
      action={
        <Link href="/matches" className="text-[13px] text-fog hover:text-bone">
          All matches
        </Link>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line">
        {rows.map((m) => {
          const opp = data.opponentById.get(m.opponent_id);
          const map = data.mapById.get(m.map_id);
          return (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3">
              <ResultChip result={m.result} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-semibold text-bone">
                  <span className="truncate">{opp?.name ?? "Unknown opponent"}</span>
                  {m.is_demo ? <DemoBadge /> : null}
                </p>
                <p className="truncate text-[13px] text-fog">
                  {map?.name} · {TYPE_LABEL[m.match_type]} · {formatDay(m.played_on)}
                </p>
              </div>
              <p className="num shrink-0 text-[22px] font-semibold text-bone">
                {m.our_score}
                <span className="mx-1 text-dim">–</span>
                {m.opp_score}
              </p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function MapPerformance({ data, matches }: { data: OverviewData; matches: MatchRow[] }) {
  const stats = mapStats(matches);
  const { strongest, weakest, eligibleCount } = strongestAndWeakest(stats);
  return (
    <Panel title="Map performance" description="Win rate per map, most played first.">
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Callout label="Strongest" items={strongest.map((s) => `${data.mapById.get(s.mapId)?.name} ${formatPct(s.winRate)}`)} />
        <Callout label="Weakest" items={weakest.map((s) => `${data.mapById.get(s.mapId)?.name} ${formatPct(s.winRate)}`)} />
      </div>
      {eligibleCount === 0 ? (
        <p className="mb-4 text-[13px] text-dim">Strongest and weakest maps appear once a map has 3 or more matches.</p>
      ) : null}
      <table className="w-full text-left">
        <thead className="sr-only">
          <tr>
            <th>Map</th>
            <th>Record</th>
            <th>Win rate</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const map = data.mapById.get(s.mapId);
            return (
              <tr key={s.mapId} className="border-t border-line first:border-t-0">
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-3">
                    {map?.image ? (
                      <img src={map.image} alt="" className="hidden h-7 w-14 shrink-0 object-cover opacity-80 sm:block" loading="lazy" />
                    ) : (
                      <span aria-hidden className="hidden h-7 w-14 shrink-0 bg-raised sm:block" />
                    )}
                    <span className="min-w-0">
                      <span className="block font-semibold text-bone">{map?.name}</span>
                      {s.smallSample ? <SmallSample played={s.played} /> : null}
                    </span>
                  </span>
                </td>
                <td className="num whitespace-nowrap py-2.5 pr-4 text-[16px] text-fog">
                  <WLD wins={s.wins} losses={s.losses} draws={s.draws} />
                  <span className="ml-2 hidden text-[13px] text-dim sm:inline">{formatDiff(s.roundDiff)} rds</span>
                </td>
                <td className="w-[42%] py-2.5">
                  <RateBar value={s.winRate} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

/** "4W 1L" (+ "1D" when there are draws), readable without a legend. */
export function WLD({ wins, losses, draws }: { wins: number; losses: number; draws: number }) {
  return (
    <span aria-label={`${wins} wins, ${losses} losses${draws ? `, ${draws} draws` : ""}`}>
      {wins}W {losses}L{draws ? ` ${draws}D` : ""}
    </span>
  );
}

function Callout({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="border-l-2 border-accent/70 bg-raised/50 px-4 py-3">
      <p className="text-[12.5px] text-fog">{label}</p>
      <p className="type-display mt-1 text-[20px] font-bold text-bone">{items.length ? items.join(" · ") : "Not enough data"}</p>
    </div>
  );
}

export function Compositions({ data, matches }: { data: OverviewData; matches: MatchRow[] }) {
  const comps = compStats(matches).slice(0, 5);
  return (
    <Panel
      title="Compositions"
      description="Your most played five-agent lineups. Agent order doesn't matter."
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line">
        {comps.map((c) => {
          const agents = c.agentIds
            .map((id) => data.agentById.get(id))
            .filter((a): a is NonNullable<typeof a> => Boolean(a))
            .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
          return (
            <li key={c.key} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-4">
              <Comp agents={agents} size={30} />
              <div className="flex flex-1 items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="num text-[16px] text-fog">
                    <WLD wins={c.wins} losses={c.losses} draws={c.draws} />
                  </p>
                  {c.smallSample ? <SmallSample played={c.played} /> : null}
                </div>
                <p className="num text-[24px] font-semibold text-bone">{formatPct(c.winRate)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function AgentsMostUsed({ data, matches }: { data: OverviewData; matches: MatchRow[] }) {
  const usage = agentUsage(matches).slice(0, 8);
  return (
    <Panel title="Most played agents" description={`Share of your ${matches.length} matches.`}>
      <ul className="flex flex-col gap-2.5">
        {usage.map((u) => {
          const a = data.agentById.get(u.agentId);
          if (!a) return null;
          return (
            <li key={u.agentId} className="grid grid-cols-[28px_84px_1fr] items-center gap-3">
              <Comp agents={[a]} size={28} />
              <span className="truncate text-[14px] font-semibold text-bone">{a.name}</span>
              <RateBar value={u.pickRate} />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function UpcomingPractice({ data, timezone, canEdit }: { data: OverviewData; timezone: string; canEdit: boolean }) {
  return (
    <Panel
      title="Upcoming practice"
      action={
        <Link href="/practice" className="text-[13px] text-fog hover:text-bone">
          Planner
        </Link>
      }
    >
      {data.sessions.length === 0 ? (
        <EmptyState
          title="No sessions planned"
          action={
            canEdit ? (
              <Link href="/practice" className={buttonClass("secondary")}>
                <Plus className="size-4" aria-hidden /> Plan a session
              </Link>
            ) : null
          }
        >
          Planned training sessions show up here.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {data.sessions.map((s) => (
            <li key={s.id} className="flex gap-3">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold text-bone">
                  {s.session_type}
                  {s.map_id ? ` · ${data.mapById.get(s.map_id)?.name}` : ""} {s.is_demo ? <DemoBadge className="ml-1 align-middle" /> : null}
                </p>
                <p className="text-[13px] text-fog">
                  {formatDateTime(s.starts_at, timezone)} · {formatDuration(s.duration_min)}
                </p>
                {s.objective ? <p className="mt-0.5 text-[13.5px] text-fog">{s.objective}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

