/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { actorOf, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog, type MapRow } from "@/lib/data/catalog";
import { strategyCounts } from "@/lib/data/playbook";
import { listMatches } from "@/lib/data/matches";
import { formatPct, mapStats, type MapStat } from "@/lib/stats/matches";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/panel";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Map Playbook" };

export default async function PlaybookPage() {
  const { viewer, canEdit } = await sectionAccess("playbook");
  const { catalog, counts, matches } = await withActor(actorOf(viewer), async (tx) => ({
    catalog: await loadCatalog(tx),
    counts: await strategyCounts(tx),
    matches: await listMatches(tx),
  }));
  const countBy = new Map(counts.map((c) => [c.map_id, c]));
  const statBy = new Map(mapStats(matches).map((s) => [s.mapId, s]));
  const visible = catalog.maps.filter((m) => m.active);
  const pool = visible.filter((m) => m.in_rotation);
  const rest = visible.filter((m) => !m.in_rotation);

  const card = (m: MapRow) => <MapCard key={m.id} map={m} counts={countBy.get(m.id)} stat={statBy.get(m.id)} />;

  return (
    <>
      <PageHeader
        title="Map Playbook"
        description="Your own tactical base: map notes, callouts and T and CT side strategies."
        actions={
          canEdit ? (
            <Link href="/settings/maps" className={buttonClass("secondary")}>
              <Settings2 className="size-4" aria-hidden /> Edit rotation
            </Link>
          ) : null
        }
      />
      <PageBody>
        <section>
          <h2 className="type-display mb-4 text-[22px] font-bold">Active competitive pool</h2>
          {pool.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{pool.map(card)}</div>
          ) : (
            <EmptyState
              title="No maps in the competitive pool yet"
              action={canEdit ? <Link href="/settings/maps" className={buttonClass("secondary")}>Choose the pool</Link> : null}
            >
              Pick the maps your team plays in Settings → Maps. They will appear here first.
            </EmptyState>
          )}
        </section>
        <section className="mt-10">
          <h2 className="type-display mb-4 text-[22px] font-bold">Outside competitive rotation</h2>
          {rest.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{rest.map(card)}</div>
          ) : (
            <p className="text-fog">Every map is in the active pool.</p>
          )}
        </section>
      </PageBody>
    </>
  );
}

function MapCard({ map, counts, stat }: { map: MapRow; counts?: { total: number; approved: number }; stat?: MapStat }) {
  return (
    <Link href={`/playbook/${map.id}`} className="group relative isolate flex aspect-[16/10] flex-col justify-end overflow-hidden border border-line bg-raised">
      {map.splash ?? map.image ? (
        <img src={(map.splash ?? map.image)!} alt="" loading="lazy" className="absolute inset-0 -z-10 size-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-[1.04]" />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/55 to-transparent" />
      <span aria-hidden className="absolute left-0 top-0 h-full w-[3px] bg-accent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="p-4">
        <p className="type-display text-[34px] font-extrabold text-bone">{map.name}</p>
        <p className="mt-1 text-[13px] text-fog">
          {counts ? `${counts.total} strateg${counts.total === 1 ? "y" : "ies"} · ${counts.approved} approved` : "No strategies yet"}
          {stat ? ` · ${stat.wins}W ${stat.losses}L · ${formatPct(stat.winRate)}` : ""}
        </p>
      </div>
    </Link>
  );
}
