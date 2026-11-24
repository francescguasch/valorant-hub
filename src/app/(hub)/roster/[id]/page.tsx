/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Plus } from "lucide-react";
import { actorOf, isStaff, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { getPlayer, goalHistory, listFeedback, listGoals, recentPlayerMatches, statsByAgent } from "@/lib/data/players";
import { playerAggregates } from "@/lib/data/matches";
import { formatPct, ratio } from "@/lib/stats/matches";
import { formatDay } from "@/lib/format";
import { PageBody } from "@/components/shell/page-header";
import { EmptyState, FormNotice, Panel, ResultChip } from "@/components/ui/panel";
import { AgentIcon, Comp } from "@/components/ui/agent";
import { buttonClass } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm";
import { GoalCard } from "@/components/development/goal-card";
import { FeedbackCard } from "@/components/development/feedback-card";
import { WeeklyEvolution } from "@/components/development/weekly-evolution";
import { deletePlayer } from "../actions";

export const metadata: Metadata = { title: "Player" };

export default async function PlayerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { viewer, canEdit } = await sectionAccess("roster");
  const isMember = viewer.kind === "member";
  const data = await withActor(actorOf(viewer), async (tx) => {
    const goals = isMember ? await listGoals(tx, id) : [];
    return {
      catalog: await loadCatalog(tx),
      player: await getPlayer(tx, id),
      total: (await playerAggregates(tx, {}, id))[0] ?? null,
      byAgent: await statsByAgent(tx, id),
      recent: await recentPlayerMatches(tx, id),
      goals,
      history: await goalHistory(tx, goals.map((g) => g.id)),
      feedback: isMember ? await listFeedback(tx, { player: id }) : [],
    };
  });
  if (!data.player) notFound();
  const { catalog, player: p, total } = data;
  const main = p.main_role_id ? catalog.roleById.get(p.main_role_id)?.name : null;
  const secondary = p.secondary_role_id ? catalog.roleById.get(p.secondary_role_id)?.name : null;
  const agentsOf = (ids: string[]) => ids.map((x) => catalog.agentById.get(x)).filter((a): a is NonNullable<typeof a> => Boolean(a));
  const ownProfile = viewer.kind === "member" && viewer.playerId === p.id;
  const canSeeFeedback = isStaff(viewer) || ownProfile;

  return (
    <>
      <header className="border-b border-line px-5 pb-6 pt-6 sm:px-8">
        <Link href="/roster" className="inline-flex items-center gap-1 text-[14px] text-fog hover:text-bone">
          <ChevronLeft className="size-4" aria-hidden /> Roster
        </Link>
        <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="size-36 shrink-0 overflow-hidden border border-line bg-raised">
            {p.photo_url ? (
              <img src={p.photo_url} alt={p.nickname} className="size-full object-cover" />
            ) : (
              <span aria-hidden className="type-display grid size-full place-items-center text-[56px] font-extrabold text-line-strong">
                {p.nickname.slice(0, 2)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-fog">
              {main ?? "Role not set"}
              {secondary ? ` · ${secondary}` : ""}
              {!p.active ? " · Inactive" : ""}
            </p>
            <h1 className="type-display text-[52px] font-extrabold text-bone sm:text-[64px]">{p.nickname}</h1>
            {p.real_name ? <p className="text-fog">{p.real_name}</p> : null}
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-start gap-2">
              <Link href={`/roster/${p.id}/edit`} className={buttonClass("secondary")}>
                <Pencil className="size-4" aria-hidden /> Edit
              </Link>
              <ConfirmAction
                action={deletePlayer}
                hidden={{ id: p.id }}
                label="Delete"
                confirmLabel="Delete player"
                question="This deletes their scoreboards, goals and feedback too. Mark them inactive instead to keep history."
              />
            </div>
          ) : null}
        </div>
      </header>
      <PageBody>
        {saved ? <FormNotice>Player saved.</FormNotice> : null}
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Agent pool">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[13px] text-fog">Main agents</p>
                {p.main_agent_ids.length ? <Comp agents={agentsOf(p.main_agent_ids)} size={36} /> : <p className="text-dim">Not set</p>}
                <p className="mt-1 text-[13px] text-fog">{agentsOf(p.main_agent_ids).map((a) => a.name).join(" · ")}</p>
              </div>
              <div>
                <p className="mb-2 text-[13px] text-fog">Secondary agents</p>
                {p.secondary_agent_ids.length ? <Comp agents={agentsOf(p.secondary_agent_ids)} size={36} /> : <p className="text-dim">Not set</p>}
                <p className="mt-1 text-[13px] text-fog">{agentsOf(p.secondary_agent_ids).map((a) => a.name).join(" · ")}</p>
              </div>
            </div>
            {isMember && (p.strengths || p.weaknesses) ? (
              <dl className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[13px] text-fog">Strengths</dt>
                  <dd className="whitespace-pre-wrap text-bone">{p.strengths ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-fog">Weaknesses</dt>
                  <dd className="whitespace-pre-wrap text-bone">{p.weaknesses ?? "—"}</dd>
                </div>
              </dl>
            ) : null}
          </Panel>

          <Panel title="Individual stats" description="From the match scoreboards.">
            {!total ? (
              <p className="text-dim">No scoreboards entered for {p.nickname} yet.</p>
            ) : (
              <>
                <dl className="grid grid-cols-3 gap-4 sm:grid-cols-6">
                  {[
                    ["Maps", String(total.maps)],
                    ["Win rate", formatPct(ratio(total.wins, total.maps))],
                    ["K/D", total.deaths ? (total.kills / total.deaths).toFixed(2) : "—"],
                    ["ACS", total.acs ?? "—"],
                    ["ADR", total.adr ?? "—"],
                    ["HS%", total.hs_pct !== null ? `${total.hs_pct}%` : "—"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[12.5px] text-fog">{k}</dt>
                      <dd className="num text-[26px] font-semibold text-bone">{v}</dd>
                    </div>
                  ))}
                </dl>
                <table className="mt-5 w-full text-left">
                  <thead className="text-[12.5px] text-fog">
                    <tr>
                      <th className="py-2 font-medium">Agent</th>
                      <th className="py-2 font-medium">Maps</th>
                      <th className="py-2 font-medium">Win rate</th>
                      <th className="py-2 font-medium">K/D</th>
                      <th className="py-2 font-medium">ACS</th>
                    </tr>
                  </thead>
                  <tbody className="num text-[16px] text-bone">
                    {data.byAgent.map((a) => {
                      const ag = a.agent_id ? catalog.agentById.get(a.agent_id) : null;
                      return (
                        <tr key={a.agent_id ?? "none"} className="border-t border-line">
                          <td className="py-2">
                            <span className="flex items-center gap-2 font-sans text-[14.5px]">
                              {ag ? <AgentIcon name={ag.name} image={ag.image} size={24} /> : null}
                              {ag?.name ?? "Not recorded"}
                            </span>
                          </td>
                          <td className="py-2">{a.maps}</td>
                          <td className="py-2">{formatPct(ratio(a.wins, a.maps))}</td>
                          <td className="py-2">{a.deaths ? (a.kills / a.deaths).toFixed(2) : "—"}</td>
                          <td className="py-2">{a.acs ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}
          </Panel>

          {data.recent.length ? (
            <Panel title="Recent matches" className="xl:col-span-2" bodyClassName="p-0">
              <ul className="divide-y divide-line">
                {data.recent.map((r) => {
                  const ag = r.agent_id ? catalog.agentById.get(r.agent_id) : null;
                  return (
                    <li key={r.match_id}>
                      <Link href={`/matches/${r.match_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.025]">
                        <ResultChip result={r.result} size="sm" />
                        {ag ? <AgentIcon name={ag.name} image={ag.image} size={26} /> : null}
                        <span className="min-w-0 flex-1 truncate text-bone">
                          {catalog.mapById.get(r.map_id)?.name} vs {catalog.opponentById.get(r.opponent_id)?.name}
                          <span className="text-[13px] text-dim"> · {formatDay(r.played_on)}</span>
                        </span>
                        <span className="num text-[16px] text-fog">
                          {r.kills ?? "—"}/{r.deaths ?? "—"}/{r.assists ?? "—"} · {r.acs ?? "—"} ACS
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ) : null}

          {isMember ? (
            <Panel
              title="Personal goals"
              className="xl:col-span-2"
              action={
                canEdit ? (
                  <Link href={`/development/goals/new?player=${p.id}`} className={buttonClass("ghost")}>
                    <Plus className="size-4" aria-hidden /> Add goal
                  </Link>
                ) : null
              }
            >
              {data.goals.length === 0 ? (
                <p className="text-dim">No goals yet.</p>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {data.goals.map((g) => (
                    <Link key={g.id} href={canEdit ? `/development/goals/${g.id}/edit` : `/roster/${p.id}`} className="block">
                      <GoalCard goal={g} history={data.history.filter((h) => h.goal_id === g.id)} />
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}

          {canSeeFeedback ? (
            <Panel
              title="Feedback history"
              description={ownProfile && !isStaff(viewer) ? "Only you and the staff can see this." : `Private: only ${p.nickname} and the staff can see this.`}
              className="xl:col-span-2"
              action={
                canEdit ? (
                  <Link href={`/development/feedback/new?player=${p.id}`} className={buttonClass("ghost")}>
                    <Plus className="size-4" aria-hidden /> Add feedback
                  </Link>
                ) : null
              }
            >
              {data.feedback.length === 0 ? (
                <EmptyState title="No feedback yet" />
              ) : (
                <div className="flex flex-col gap-6">
                  <WeeklyEvolution feedback={data.feedback} history={data.history} />
                  <div className="flex flex-col gap-3">
                    {data.feedback.map((f) => (
                      <FeedbackCard key={f.id} f={f} href={canEdit ? `/development/feedback/${f.id}/edit` : undefined} />
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          ) : null}
        </div>
      </PageBody>
    </>
  );
}
