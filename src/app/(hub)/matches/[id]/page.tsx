import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { actorOf, isStaff, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { boardsFor } from "@/lib/data/boards";
import { BoardStrip } from "@/components/boards/board-strip";
import { compAgents, loadCatalog } from "@/lib/data/catalog";
import { getMatch } from "@/lib/data/matches";
import { formatPct, ratio } from "@/lib/stats/matches";
import { MATCH_TYPE_LABEL } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { PageBody } from "@/components/shell/page-header";
import { DemoBadge, FormNotice, Panel, ResultChip } from "@/components/ui/panel";
import { AgentIcon, Comp } from "@/components/ui/agent";
import { buttonClass } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm";
import { VideoBlock } from "@/components/ui/youtube";
import { deleteMatch } from "../actions";

export const metadata: Metadata = { title: "Match" };

const WORD = { W: "Win", L: "Loss", D: "Draw" } as const;

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { viewer, canEdit } = await sectionAccess("matches");
  const data = await withActor(actorOf(viewer), async (tx) => ({
    catalog: await loadCatalog(tx),
    detail: await getMatch(tx, id),
    boards: await boardsFor(tx, { kind: "match", id }),
  }));
  if (!data.detail) notFound();
  const { catalog, detail, boards } = data;
  const m = detail.match;
  const opp = catalog.opponentById.get(m.opponent_id);
  const map = catalog.mapById.get(m.map_id);

  const sides = [
    { label: "T side (attack)", ours: m.our_t_rounds, played: m.our_t_rounds + m.opp_ct_rounds },
    { label: "CT side (defense)", ours: m.our_ct_rounds, played: m.our_ct_rounds + m.opp_t_rounds },
    ...(m.our_ot_rounds || m.opp_ot_rounds ? [{ label: "Overtime", ours: m.our_ot_rounds, played: m.our_ot_rounds + m.opp_ot_rounds }] : []),
  ];
  const metrics = [
    { label: "Pistol rounds", value: m.pistols_won === null ? null : `${m.pistols_won} of 2` },
    { label: "Anti-eco", value: m.anti_eco_played ? `${m.anti_eco_won ?? 0} of ${m.anti_eco_played}` : null },
    { label: "Bonus rounds", value: m.bonus_played ? `${m.bonus_won ?? 0} of ${m.bonus_played}` : null },
    { label: "First blood conversion", value: m.first_bloods ? `${m.first_blood_wins ?? 0} of ${m.first_bloods} (${formatPct(ratio(m.first_blood_wins ?? 0, m.first_bloods))})` : null },
  ].filter((x) => x.value);
  const seriesWon = detail.series.filter((s) => s.result === "W").length;
  const seriesLost = detail.series.filter((s) => s.result === "L").length;

  return (
    <>
      <header className="relative overflow-hidden border-b border-line">
        {map?.splash ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={map.splash} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-25" />
        ) : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/85 to-ink/40" />
        <div className="px-5 pb-6 pt-6 sm:px-8">
          <Link href="/matches" className="inline-flex items-center gap-1 text-[14px] text-fog hover:text-bone">
            <ChevronLeft className="size-4" aria-hidden /> Match Center
          </Link>
          <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="flex flex-wrap items-center gap-2 text-[14px] text-fog">
                {MATCH_TYPE_LABEL[m.match_type]}
                {m.competition ? ` · ${m.competition}` : ""} · {formatDay(m.played_on, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                {m.is_demo ? <DemoBadge /> : null}
              </p>
              <h1 className="type-display mt-2 text-[40px] font-extrabold text-bone sm:text-[52px]">
                {map?.name} <span className="text-fog">vs</span> {opp?.name}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <ResultChip result={m.result} />
              <p className="num text-[64px] font-semibold leading-none text-bone">
                {m.our_score}
                <span className="mx-2 text-dim">–</span>
                {m.opp_score}
              </p>
            </div>
          </div>
          {canEdit ? (
            <div className="mt-5 flex flex-wrap items-start gap-2">
              <Link href={`/matches/${m.id}/edit`} className={buttonClass("secondary")}>
                <Pencil className="size-4" aria-hidden /> Edit
              </Link>
              <ConfirmAction action={deleteMatch} hidden={{ id: m.id }} label="Delete" confirmLabel="Delete match" question="Delete this map and its scoreboard? This can't be undone." />
            </div>
          ) : null}
        </div>
      </header>

      <PageBody>
        {saved ? <FormNotice>Match saved. Stats across the hub are up to date.</FormNotice> : null}
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Rounds" description={`${WORD[m.result]} by ${Math.abs(m.round_diff)} round${Math.abs(m.round_diff) === 1 ? "" : "s"}.`}>
            <table className="w-full text-left">
              <thead className="text-[12.5px] text-fog">
                <tr>
                  <th className="pb-2 font-medium">Side</th>
                  <th className="pb-2 font-medium">Won</th>
                  <th className="pb-2 font-medium">Played</th>
                  <th className="pb-2 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody className="num text-[20px] text-bone">
                {sides.map((s) => (
                  <tr key={s.label} className="border-t border-line">
                    <td className="py-2 font-sans text-[14.5px] text-fog">{s.label}</td>
                    <td className="py-2">{s.ours}</td>
                    <td className="py-2">{s.played}</td>
                    <td className="py-2">{formatPct(ratio(s.ours, s.played))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {metrics.length ? (
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
                {metrics.map((x) => (
                  <div key={x.label}>
                    <dt className="text-[12.5px] text-fog">{x.label}</dt>
                    <dd className="text-[16px] text-bone">{x.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </Panel>

          <Panel title="Compositions">
            <div className="flex flex-col gap-5">
              <div>
                <p className="mb-2 text-[13px] text-fog">Your team</p>
                <CompNames agents={compAgents(catalog, m.our_agent_ids)} />
              </div>
              <div>
                <p className="mb-2 text-[13px] text-fog">{opp?.name}</p>
                <CompNames agents={compAgents(catalog, m.opp_agent_ids)} />
              </div>
            </div>
          </Panel>

          {detail.series.length > 1 ? (
            <Panel title={`Series ${m.series_format ?? ""}`} description={`${m.series_id} · ${seriesWon}–${seriesLost} in maps`} bodyClassName="p-0">
              <ul className="divide-y divide-line">
                {detail.series.map((s) => (
                  <li key={s.id}>
                    <Link href={`/matches/${s.id}`} className={`flex items-center gap-3 px-5 py-3 hover:bg-white/[0.025] ${s.id === m.id ? "bg-raised/60" : ""}`}>
                      <ResultChip result={s.result} size="sm" />
                      <span className="flex-1 text-bone">
                        Map {s.map_number ?? "?"} · {catalog.mapById.get(s.map_id)?.name}
                      </span>
                      <span className="num text-[20px] text-bone">
                        {s.our_score}–{s.opp_score}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {detail.stats.length ? (
            <Panel title="Scoreboard" className="xl:col-span-2" bodyClassName="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-left">
                <thead className="text-[12.5px] text-fog">
                  <tr>
                    {["Player", "K / D / A", "K/D", "ACS", "ADR", "HS%", "FK", "FD"].map((h) => (
                      <th key={h} className="px-5 py-2.5 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="num text-[17px] text-bone">
                  {[...detail.stats]
                    .sort((a, b) => (b.acs ?? 0) - (a.acs ?? 0))
                    .map((s) => {
                      const agent = s.agent_id ? catalog.agentById.get(s.agent_id) : null;
                      const kd = s.kills !== null && s.deaths ? (s.kills / s.deaths).toFixed(2) : "—";
                      return (
                        <tr key={s.player_id} className="border-t border-line">
                          <td className="px-5 py-2.5">
                            <Link href={`/roster/${s.player_id}`} className="flex items-center gap-2.5 font-sans text-[15px] font-semibold hover:underline">
                              {agent ? <AgentIcon name={agent.name} image={agent.image} size={26} /> : null}
                              {catalog.playerById.get(s.player_id)?.nickname}
                            </Link>
                          </td>
                          <td className="px-5 py-2.5">
                            {s.kills ?? "—"} / {s.deaths ?? "—"} / {s.assists ?? "—"}
                          </td>
                          <td className="px-5 py-2.5">{kd}</td>
                          <td className="px-5 py-2.5">{s.acs ?? "—"}</td>
                          <td className="px-5 py-2.5">{s.adr ?? "—"}</td>
                          <td className="px-5 py-2.5">{s.hs_pct ? `${s.hs_pct}%` : "—"}</td>
                          <td className="px-5 py-2.5">{s.first_kills ?? "—"}</td>
                          <td className="px-5 py-2.5">{s.first_deaths ?? "—"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </Panel>
          ) : null}

          {detail.notes?.notes || (isStaff(viewer) && detail.coachNotes) ? (
            <Panel title="Notes" className="xl:col-span-2">
              <div className="grid gap-6 lg:grid-cols-2">
                {detail.notes?.notes ? (
                  <div>
                    <p className="mb-1 text-[13px] text-fog">Match notes</p>
                    <p className="whitespace-pre-wrap text-bone">{detail.notes.notes}</p>
                  </div>
                ) : null}
                {isStaff(viewer) && detail.coachNotes ? (
                  <div>
                    <p className="mb-1 text-[13px] text-fog">Coach notes · staff only</p>
                    <p className="whitespace-pre-wrap text-bone">{detail.coachNotes}</p>
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}

          {detail.notes?.vod_url ? (
            <Panel title="VOD" className="xl:col-span-2">
              <VideoBlock url={detail.notes.vod_url} title={`${map?.name} vs ${opp?.name}`} />
            </Panel>
          ) : null}
        </div>
        <BoardStrip
          className="mt-5"
          boards={boards.boards}
          catalog={boards.catalog}
          canEdit={canEdit}
          newHref={`/boards/new?match=${id}`}
          description="Rounds and situations from this match, drawn on the map. Only team members see them."
        />
      </PageBody>
    </>
  );
}

function CompNames({ agents }: { agents: { id: string; name: string; image: string | null }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Comp agents={agents} size={40} />
      <p className="w-full text-[14px] text-fog">{agents.map((a) => a.name).join(" · ")}</p>
    </div>
  );
}
