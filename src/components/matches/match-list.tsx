import Link from "next/link";
import type { Catalog } from "@/lib/data/catalog";
import { compAgents } from "@/lib/data/catalog";
import type { MatchRow } from "@/lib/stats/matches";
import { MATCH_TYPE_LABEL } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { Comp } from "../ui/agent";
import { DemoBadge, ResultChip } from "../ui/panel";

/** Match rows: a table on wide screens, stacked cards on phones. Each row opens the match. */
export function MatchList({ matches, catalog, showOpponent = true }: { matches: MatchRow[]; catalog: Catalog; showOpponent?: boolean }) {
  return (
    <ul className="divide-y divide-line border border-line bg-panel">
      {matches.map((m) => {
        const opp = catalog.opponentById.get(m.opponent_id);
        const map = catalog.mapById.get(m.map_id);
        return (
          <li key={m.id}>
            <Link
              href={`/matches/${m.id}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-white/[0.025] md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] md:px-5"
            >
              <ResultChip result={m.result} />
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold text-bone">
                  <span className="truncate">{showOpponent ? (opp?.name ?? "Unknown opponent") : map?.name}</span>
                  {m.is_demo ? <DemoBadge /> : null}
                </p>
                <p className="truncate text-[13px] text-fog">
                  {showOpponent ? `${map?.name} · ` : ""}
                  {MATCH_TYPE_LABEL[m.match_type]}
                  {m.competition ? ` · ${m.competition}` : ""} · {formatDay(m.played_on, { month: "short", day: "numeric", year: "numeric" })}
                  {m.series_format ? ` · ${m.series_format}${m.map_number ? ` map ${m.map_number}` : ""}` : ""}
                </p>
              </div>
              <div className="col-span-3 row-start-2 md:col-span-1 md:row-start-auto">
                <Comp agents={compAgents(catalog, m.our_agent_ids)} size={26} />
              </div>
              <p className="num col-start-3 row-start-1 text-right text-[24px] font-semibold text-bone md:col-start-auto md:row-start-auto">
                {m.our_score}
                <span className="mx-1 text-dim">–</span>
                {m.opp_score}
              </p>
              <p className="hidden w-14 text-right text-[13px] text-dim md:block">
                {m.round_diff > 0 ? `+${m.round_diff}` : m.round_diff}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
