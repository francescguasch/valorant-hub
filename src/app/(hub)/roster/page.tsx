/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { actorOf, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { getSettings } from "@/lib/data/settings";
import { loadCatalog } from "@/lib/data/catalog";
import { listPlayers, type PlayerFull } from "@/lib/data/players";
import { playerAggregates, type PlayerAggregate } from "@/lib/data/matches";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState, FormNotice } from "@/components/ui/panel";
import { Comp } from "@/components/ui/agent";
import { buttonClass } from "@/components/ui/button";
import type { Catalog } from "@/lib/data/catalog";

export const metadata: Metadata = { title: "Roster" };

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const { viewer, canEdit } = await sectionAccess("roster");
  const settings = await getSettings();
  const { catalog, players, stats } = await withActor(actorOf(viewer), async (tx) => ({
    catalog: await loadCatalog(tx),
    players: await listPlayers(tx),
    stats: await playerAggregates(tx),
  }));
  const statBy = new Map(stats.map((s) => [s.player_id, s]));
  const active = players.filter((p) => p.active);
  const inactive = players.filter((p) => !p.active);
  return (
    <>
      {settings.roster_image_url ? (
        <header className="relative isolate overflow-hidden border-b border-line">
          {/* The team photo, untouched; overlays only darken the bottom for the title. */}
          <img
            src={settings.roster_image_url}
            alt={`${settings.university_name} ${settings.team_name}`}
            className="absolute inset-0 -z-10 size-full object-cover object-[center_35%]"
            fetchPriority="high"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/45 to-ink/5" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(110deg,color-mix(in_oklab,var(--accent)_26%,transparent),transparent_38%)]" />
          <div className="flex min-h-[300px] flex-col justify-end gap-4 px-5 pb-7 pt-24 sm:min-h-[420px] sm:flex-row sm:items-end sm:justify-between sm:px-8 xl:min-h-[520px]">
            <div className="min-w-0">
              <p className="type-display text-[15px] font-bold uppercase tracking-[0.12em] text-accent">
                {settings.university_name}
              </p>
              <h1 className="type-display text-[56px] font-extrabold leading-none text-bone sm:text-[84px]">Roster</h1>
              <p className="mt-2 max-w-[60ch] text-bone/85">
                Players, roles and agent pools. Open a player for every match they played and their performance by agent
                and map.
              </p>
            </div>
            {canEdit ? (
              <Link href="/roster/new" className={buttonClass("primary")}>
                <Plus className="size-4" aria-hidden /> Add player
              </Link>
            ) : null}
          </div>
        </header>
      ) : (
        <PageHeader
          title="Roster"
          description="Players, roles and agent pools. Stats come from the scoreboards entered in Match Center."
          actions={
            canEdit ? (
              <Link href="/roster/new" className={buttonClass("primary")}>
                <Plus className="size-4" aria-hidden /> Add player
              </Link>
            ) : null
          }
        />
      )}
      <PageBody>
        {deleted ? <FormNotice>Player removed.</FormNotice> : null}
        {active.length === 0 ? (
          <EmptyState title="No active players">Add the team&apos;s players to build the roster.</EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {active.map((p) => (
              <PlayerCard key={p.id} p={p} catalog={catalog} stat={statBy.get(p.id)} />
            ))}
          </ul>
        )}
        {inactive.length ? (
          <section className="mt-10">
            <h2 className="type-display mb-4 text-[20px] font-bold text-fog">Inactive</h2>
            <ul className="grid gap-4 opacity-70 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {inactive.map((p) => (
                <PlayerCard key={p.id} p={p} catalog={catalog} stat={statBy.get(p.id)} />
              ))}
            </ul>
          </section>
        ) : null}
      </PageBody>
    </>
  );
}

function PlayerCard({ p, catalog, stat }: { p: PlayerFull; catalog: Catalog; stat?: PlayerAggregate }) {
  const main = p.main_role_id ? catalog.roleById.get(p.main_role_id)?.name : null;
  const secondary = p.secondary_role_id ? catalog.roleById.get(p.secondary_role_id)?.name : null;
  const agents = p.main_agent_ids
    .map((id) => catalog.agentById.get(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  return (
    <li>
      <Link
        href={`/roster/${p.id}`}
        className="group flex h-full flex-col border border-line bg-panel transition-colors hover:border-line-strong"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-raised">
          {p.photo_url ? (
            <img
              src={p.photo_url}
              alt={p.nickname}
              className="size-full object-cover object-[center_30%]"
              loading="lazy"
            />
          ) : (
            <span
              aria-hidden
              className="type-display grid size-full place-items-center text-[64px] font-extrabold text-line-strong"
            >
              {p.nickname.slice(0, 2)}
            </span>
          )}
          <span
            aria-hidden
            className="absolute bottom-0 left-0 h-[3px] w-full origin-left scale-x-0 bg-accent transition-transform group-hover:scale-x-100"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="type-display text-[26px] font-extrabold text-bone">{p.nickname}</p>
          <p className="text-[13.5px] text-fog">
            {main ?? "Role not set"}
            {secondary ? ` · ${secondary}` : ""}
          </p>
          {agents.length ? <Comp agents={agents} size={26} /> : null}
          <p className="mt-auto pt-2 text-[13px] text-dim">
            {stat
              ? `${stat.maps} maps · K/D ${stat.deaths ? (stat.kills / stat.deaths).toFixed(2) : "—"} · ACS ${stat.acs ?? "—"}`
              : "No scoreboards yet"}
          </p>
        </div>
      </Link>
    </li>
  );
}
