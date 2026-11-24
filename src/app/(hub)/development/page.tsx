import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { actorOf, isStaff, requireMember } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { goalHistory, listFeedback, listGoals } from "@/lib/data/players";
import { FEEDBACK_STATUS, SKILL_CATEGORIES } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { DemoBadge, EmptyState, FormNotice } from "@/components/ui/panel";
import { buttonClass } from "@/components/ui/button";
import { FeedbackCard } from "@/components/development/feedback-card";
import { GoalCard } from "@/components/development/goal-card";
import { WeeklyEvolution } from "@/components/development/weekly-evolution";

export const metadata: Metadata = { title: "Player Development" };

type Tab = "feedback" | "goals" | "objectives";
const UUID = /^[0-9a-f-]{36}$/;

export default async function DevelopmentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const me = await requireMember("/development");
  const staff = isStaff(me);
  const tab: Tab = sp.tab === "goals" || sp.tab === "objectives" ? sp.tab : "feedback";
  const player = sp.player && UUID.test(sp.player) ? sp.player : staff ? undefined : (me.playerId ?? undefined);
  const category = sp.category && (SKILL_CATEGORIES as readonly string[]).includes(sp.category) ? sp.category : undefined;
  const status = sp.status && FEEDBACK_STATUS.some((s) => s.value === sp.status) ? sp.status : undefined;

  const data = await withActor(actorOf(me), async (tx) => {
    const goals = await listGoals(tx, player);
    return {
      catalog: await loadCatalog(tx),
      feedback: await listFeedback(tx, { player, category, status }),
      goals,
      history: await goalHistory(tx, goals.map((g) => g.id)),
      objectives: await tx<{ id: string; title: string; details: string | null; kind: string; progress: number; status: string; due_on: string | null; is_demo: boolean }[]>`
        select id, title, details, kind, progress, status, due_on, is_demo from public.team_objectives order by (status <> 'active'), kind, sort_order, created_at`,
    };
  });
  const name = (id: string) => data.catalog.playerById.get(id)?.nickname ?? "Player";
  const q = (t: Tab) => `/development?tab=${t}${player && staff ? `&player=${player}` : ""}`;

  return (
    <>
      <PageHeader
        title="Player Development"
        description={
          staff
            ? "Feedback, personal goals and team objectives. Feedback is private to each player and the staff."
            : "Your feedback and goals from the staff, plus the team's objectives. Your feedback is private to you and the staff."
        }
        actions={
          staff ? (
            <Link
              href={tab === "goals" ? `/development/goals/new${player ? `?player=${player}` : ""}` : tab === "objectives" ? "/development/objectives/new" : `/development/feedback/new${player ? `?player=${player}` : ""}`}
              className={buttonClass("primary")}
            >
              <Plus className="size-4" aria-hidden /> {tab === "goals" ? "Add goal" : tab === "objectives" ? "Add objective" : "Add feedback"}
            </Link>
          ) : null
        }
      />
      <nav aria-label="Development sections" className="flex gap-6 border-b border-line px-5 sm:px-8">
        {(["feedback", "goals", "objectives"] as Tab[]).map((t) => (
          <Link key={t} href={q(t)} aria-current={tab === t ? "page" : undefined} className={clsx("relative py-3.5 text-[14.5px] font-medium", tab === t ? "text-bone" : "text-fog hover:text-bone")}>
            {t === "feedback" ? "Feedback" : t === "goals" ? "Goals" : "Team objectives"}
            <span aria-hidden className={clsx("absolute inset-x-0 -bottom-px h-[2px] bg-accent", tab === t ? "opacity-100" : "opacity-0")} />
          </Link>
        ))}
      </nav>
      <PageBody>
        {sp.saved ? <FormNotice>Saved.</FormNotice> : null}
        {sp.deleted ? <FormNotice>Deleted.</FormNotice> : null}

        {tab === "feedback" ? (
          <>
            {staff ? (
              <FilterBar resetHref="/development" active={Boolean(player || category || status)}>
                <input type="hidden" name="tab" value="feedback" />
                <FilterSelect label="Player" name="player" value={player} options={data.catalog.players.map((p) => ({ value: p.id, label: p.nickname }))} />
                <FilterSelect label="Category" name="category" value={category} options={SKILL_CATEGORIES.map((c) => ({ value: c, label: c }))} />
                <FilterSelect label="Status" name="status" value={status} options={FEEDBACK_STATUS.map((s) => ({ value: s.value, label: s.label }))} />
              </FilterBar>
            ) : null}
            {player && data.feedback.length ? (
              <div className="mb-6 border border-line bg-panel p-5">
                <WeeklyEvolution feedback={data.feedback} history={data.history} />
              </div>
            ) : null}
            {data.feedback.length === 0 ? (
              <EmptyState title="No feedback here yet">{staff ? "Add the first piece of feedback for a player." : "When the staff gives you feedback it appears here."}</EmptyState>
            ) : (
              <div className="flex flex-col gap-3">
                {data.feedback.map((f) => (
                  <FeedbackCard key={f.id} f={f} playerName={name(f.player_id)} href={staff ? `/development/feedback/${f.id}/edit` : undefined} />
                ))}
              </div>
            )}
          </>
        ) : null}

        {tab === "goals" ? (
          <>
            {staff ? (
              <FilterBar resetHref="/development?tab=goals" active={Boolean(player)}>
                <input type="hidden" name="tab" value="goals" />
                <FilterSelect label="Player" name="player" value={player} options={data.catalog.players.map((p) => ({ value: p.id, label: p.nickname }))} />
              </FilterBar>
            ) : null}
            {data.goals.length === 0 ? (
              <EmptyState title="No goals yet">{staff ? "Set measurable goals for each player and track their progress." : "Your personal goals appear here."}</EmptyState>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {data.goals.map((g) => {
                  const card = <GoalCard goal={g} history={data.history.filter((h) => h.goal_id === g.id)} playerName={name(g.player_id)} />;
                  return staff ? (
                    <Link key={g.id} href={`/development/goals/${g.id}/edit`} className="block transition-opacity hover:opacity-90">
                      {card}
                    </Link>
                  ) : (
                    <div key={g.id}>{card}</div>
                  );
                })}
              </div>
            )}
          </>
        ) : null}

        {tab === "objectives" ? (
          data.objectives.length === 0 ? (
            <EmptyState title="No team objectives yet">{staff ? "They appear on the Overview for the whole team." : "The staff hasn't set team objectives yet."}</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.objectives.map((o) => {
                const body = (
                  <div className="flex flex-col gap-2 border border-line bg-panel p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[12.5px] text-fog">
                          {o.kind === "priority" ? "Staff priority" : "Team objective"} · {o.status === "active" ? "Active" : o.status === "done" ? "Done" : "Dropped"}
                          {o.due_on ? ` · due ${formatDay(o.due_on)}` : ""}
                        </p>
                        <p className="font-semibold text-bone">
                          {o.title} {o.is_demo ? <DemoBadge className="ml-1 align-middle" /> : null}
                        </p>
                      </div>
                      {o.kind === "objective" ? <span className="num text-[24px] font-semibold text-bone">{o.progress}%</span> : null}
                    </div>
                    {o.kind === "objective" ? (
                      <span className="relative block h-1.5 bg-line">
                        <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-accent" style={{ width: `${o.progress}%` }} />
                      </span>
                    ) : null}
                    {o.details ? <p className="text-[14px] text-fog">{o.details}</p> : null}
                  </div>
                );
                return (
                  <li key={o.id}>
                    {staff ? (
                      <Link href={`/development/objectives/${o.id}/edit`} className="block hover:opacity-90">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </PageBody>
    </>
  );
}
