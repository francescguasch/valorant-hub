import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { actorOf, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { listMatches } from "@/lib/data/matches";
import { formatDiff, formatPct, recentFirst, record } from "@/lib/stats/matches";
import { formatDay } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { DemoBadge, EmptyState, ResultChip } from "@/components/ui/panel";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Opponent Scouting" };

export default async function ScoutingPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { viewer, canEdit } = await sectionAccess("scouting");
  const { catalog, matches } = await withActor(actorOf(viewer), async (tx) => ({ catalog: await loadCatalog(tx), matches: await listMatches(tx) }));
  const query = (q ?? "").trim().toLowerCase();
  const rows = catalog.opponents
    .filter((o) => !query || o.name.toLowerCase().includes(query) || o.short_name?.toLowerCase().includes(query))
    .map((o) => {
      const games = recentFirst(matches.filter((m) => m.opponent_id === o.id));
      return { o, r: record(games), last: games[0] ?? null, recent: games.slice(0, 5) };
    })
    .sort((a, b) => (b.last?.played_on ?? "").localeCompare(a.last?.played_on ?? "") || a.o.name.localeCompare(b.o.name));

  return (
    <>
      <PageHeader
        title="Opponent Scouting"
        description="Every team you've played or plan to play. Opponents are added automatically from Match Center."
        actions={canEdit ? <Link href="/settings/opponents" className={buttonClass("secondary")}>Add or edit opponents</Link> : null}
      />
      <PageBody>
        <form method="get" className="mb-6 flex max-w-md items-center gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search opponents</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" aria-hidden />
            <input name="q" defaultValue={q ?? ""} placeholder="Search opponents" className="field pl-9" />
          </label>
          <button className={buttonClass("secondary", "h-[42px]")}>Search</button>
        </form>
        {rows.length === 0 ? (
          <EmptyState title={query ? "No opponent matches that search" : "No opponents yet"}>
            {query ? "Try another name." : "They appear as soon as you record a match in Match Center."}
          </EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {rows.map(({ o, r, last, recent }) => (
              <li key={o.id}>
                <Link href={`/scouting/${o.id}`} className="flex h-full flex-col gap-3 border border-line bg-panel p-5 transition-colors hover:border-line-strong">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 text-[17px] font-semibold text-bone">
                      {o.name} {o.is_demo ? <DemoBadge /> : null}
                    </p>
                    <p className="num shrink-0 text-[24px] font-semibold text-bone">{formatPct(r.winRate)}</p>
                  </div>
                  <p className="text-[13.5px] text-fog">
                    {r.played ? `${r.wins}W ${r.losses}L${r.draws ? ` ${r.draws}D` : ""} · ${formatDiff(r.roundDiff)} rounds` : "Not played yet"}
                    {last ? ` · last met ${formatDay(last.played_on)}` : ""}
                  </p>
                  {recent.length ? (
                    <div className="mt-auto flex gap-1">
                      {recent.map((m) => (
                        <ResultChip key={m.id} result={m.result} size="sm" />
                      ))}
                    </div>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
