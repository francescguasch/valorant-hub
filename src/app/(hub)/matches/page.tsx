import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { actorOf, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { hasFilters, listMatches, parseFilters, seasonsAndCompetitions } from "@/lib/data/matches";
import { formatDiff, formatPct, record, seriesResults } from "@/lib/stats/matches";
import { MATCH_TYPES } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { FilterBar, FilterDate, FilterSelect } from "@/components/ui/filter-bar";
import { EmptyState, FormNotice, ResultChip } from "@/components/ui/panel";
import { buttonClass } from "@/components/ui/button";
import { MatchList } from "@/components/matches/match-list";

export const metadata: Metadata = { title: "Match Center" };

export default async function MatchesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { viewer, canEdit } = await sectionAccess("matches");
  const filters = parseFilters(sp);
  const { catalog, matches, meta } = await withActor(actorOf(viewer), async (tx) => ({
    catalog: await loadCatalog(tx),
    matches: await listMatches(tx, filters),
    meta: await seasonsAndCompetitions(tx),
  }));
  const r = record(matches);
  const series = seriesResults(matches).filter((s) => s.format && s.format !== "BO1");
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <PageHeader
        title="Match Center"
        description="Every map played. Scores, results and round difference are calculated from the rounds you enter."
        actions={
          <>
            {viewer.kind === "member" ? (
              <>
                <a href={`/export/matches?format=xlsx${query ? `&${query}` : ""}`} className={buttonClass("secondary")}>
                  <Download className="size-4" aria-hidden /> Excel
                </a>
                <a href={`/export/matches?format=csv${query ? `&${query}` : ""}`} className={buttonClass("secondary")}>
                  <Download className="size-4" aria-hidden /> CSV
                </a>
              </>
            ) : null}
            {canEdit ? (
              <Link href="/matches/new" className={buttonClass("primary")}>
                <Plus className="size-4" aria-hidden /> Add new match
              </Link>
            ) : null}
          </>
        }
      />
      <PageBody>
        {sp.deleted ? <FormNotice>Match deleted.</FormNotice> : null}
        <FilterBar resetHref="/matches" active={hasFilters(filters)}>
          <FilterSelect label="Season" name="season" value={filters.season} options={meta.seasons.map((s) => ({ value: s, label: s }))} />
          <FilterSelect label="Type" name="type" value={filters.type} options={MATCH_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
          <FilterSelect label="Map" name="map" value={filters.map} options={catalog.maps.map((m) => ({ value: m.id, label: m.name }))} />
          <FilterSelect label="Opponent" name="opponent" value={filters.opponent} options={catalog.opponents.map((o) => ({ value: o.id, label: o.name }))} />
          <FilterSelect label="Competition" name="competition" value={filters.competition} options={meta.competitions.map((c) => ({ value: c, label: c }))} />
          <FilterDate label="From" name="from" value={filters.from} />
          <FilterDate label="To" name="to" value={filters.to} />
        </FilterBar>

        {matches.length === 0 ? (
          <EmptyState
            title={hasFilters(filters) ? "No matches match these filters" : "No matches recorded yet"}
            action={
              canEdit && !hasFilters(filters) ? (
                <Link href="/matches/new" className={buttonClass("primary")}>
                  <Plus className="size-4" aria-hidden /> Add new match
                </Link>
              ) : null
            }
          >
            {hasFilters(filters) ? "Clear or change the filters to see more." : "Add your first scrim or official match to start building stats."}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-6">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
              {[
                ["Matches", String(r.played)],
                ["Record", `${r.wins}W ${r.losses}L${r.draws ? ` ${r.draws}D` : ""}`],
                ["Win rate", formatPct(r.winRate)],
                ["Rounds", `${r.roundsWon}–${r.roundsLost}`],
                ["Round difference", formatDiff(r.roundDiff)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[12.5px] text-fog">{k}</dt>
                  <dd className="num text-[28px] font-semibold text-bone">{v}</dd>
                </div>
              ))}
            </dl>

            {series.length ? (
              <section>
                <h2 className="type-display mb-3 text-[19px] font-bold">Series</h2>
                <ul className="flex flex-wrap gap-2">
                  {series.slice(0, 12).map((s) => (
                    <li key={s.seriesId} className="flex items-center gap-3 border border-line bg-panel px-3 py-2">
                      <ResultChip result={s.result} size="sm" />
                      <span className="text-[14px] text-bone">{catalog.opponentById.get(s.opponentId)?.name}</span>
                      <span className="num text-[18px] font-semibold text-bone">
                        {s.mapsWon}–{s.mapsLost}
                      </span>
                      <span className="text-[12.5px] text-dim">
                        {s.format} · {formatDay(s.playedOn)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <MatchList matches={matches} catalog={catalog} />
          </div>
        )}
      </PageBody>
    </>
  );
}
