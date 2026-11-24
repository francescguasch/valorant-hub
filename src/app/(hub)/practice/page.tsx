import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { actorOf, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog, type Catalog } from "@/lib/data/catalog";
import { formatDay, formatDuration } from "@/lib/format";
import { SESSION_STATUS_LABEL } from "@/lib/constants";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { DemoBadge, EmptyState, FormNotice } from "@/components/ui/panel";
import { buttonClass } from "@/components/ui/button";
import { addDays, mondayOf, sessionSelect, sessionsBetween, todayIn, tzAbbrev, type SessionRow } from "./load";

export const metadata: Metadata = { title: "Practice Planner" };
type View = "week" | "upcoming" | "completed";

export default async function PracticePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { viewer, settings, canEdit } = await sectionAccess("practice");
  const tz = settings.timezone;
  const view: View = sp.view === "upcoming" || sp.view === "completed" ? sp.view : "week";
  const today = todayIn(tz);
  const week = mondayOf(sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today);
  const data = await withActor(actorOf(viewer), async (tx) => ({
    catalog: await loadCatalog(tx),
    week: view === "week" ? await sessionsBetween(tx, tz, week, addDays(week, 7)) : [],
    list:
      view === "upcoming"
        ? await tx.unsafe<SessionRow[]>(`${sessionSelect(tz)} where status = 'planned' and starts_at >= now() - interval '3 hours' order by starts_at limit 60`)
        : view === "completed"
          ? await tx.unsafe<SessionRow[]>(`${sessionSelect(tz)} where status = 'completed' order by starts_at desc limit 60`)
          : [],
  }));
  const tzLabel = tzAbbrev(tz);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  return (
    <>
      <PageHeader
        title="Practice Planner"
        description={`Training calendar in team time (${tz.replace("_", " ")}, ${tzLabel}).`}
        actions={
          canEdit ? (
            <Link href={`/practice/new?day=${view === "week" && week > today ? week : today}`} className={buttonClass("primary")}>
              <Plus className="size-4" aria-hidden /> Plan session
            </Link>
          ) : null
        }
      />
      <nav aria-label="Planner views" className="flex gap-6 border-b border-line px-5 sm:px-8">
        {(["week", "upcoming", "completed"] as View[]).map((v) => (
          <Link key={v} href={`/practice${v === "week" ? "" : `?view=${v}`}`} aria-current={view === v ? "page" : undefined} className={clsx("relative py-3.5 text-[14.5px] font-medium", view === v ? "text-bone" : "text-fog hover:text-bone")}>
            {v === "week" ? "Weekly calendar" : v === "upcoming" ? "Upcoming" : "Completed"}
            <span aria-hidden className={clsx("absolute inset-x-0 -bottom-px h-[2px] bg-accent", view === v ? "opacity-100" : "opacity-0")} />
          </Link>
        ))}
      </nav>
      <PageBody>
        {sp.deleted ? <FormNotice>Session deleted.</FormNotice> : null}
        {view === "week" ? (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Link href={`/practice?week=${addDays(week, -7)}`} className={buttonClass("ghost")} aria-label="Previous week">
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
              <p className="type-display min-w-[220px] text-center text-[20px] font-bold text-bone">
                {formatDay(week)} – {formatDay(addDays(week, 6), { month: "short", day: "numeric", year: "numeric" })}
              </p>
              <Link href={`/practice?week=${addDays(week, 7)}`} className={buttonClass("ghost")} aria-label="Next week">
                <ChevronRight className="size-4" aria-hidden />
              </Link>
              {week !== mondayOf(today) ? (
                <Link href="/practice" className="ml-2 text-[14px] text-fog hover:text-bone">
                  This week
                </Link>
              ) : null}
            </div>
            <div className="grid gap-2 md:grid-cols-7">
              {days.map((d) => {
                const items = data.week.filter((s) => s.local_day === d);
                const isToday = d === today;
                return (
                  <section key={d} className={clsx("flex min-h-[120px] flex-col border bg-panel md:min-h-[260px]", isToday ? "border-accent/60" : "border-line")}>
                    <header className="flex items-baseline justify-between border-b border-line px-3 py-2">
                      <h3 className={clsx("text-[13px] font-semibold", isToday ? "text-accent" : "text-fog")}>{formatDay(d, { weekday: "short" })}</h3>
                      <span className="num text-[18px] text-bone">{d.slice(8)}</span>
                    </header>
                    <ul className="flex flex-1 flex-col gap-2 p-2">
                      {items.map((s) => (
                        <li key={s.id}>
                          <SessionChip s={s} catalog={data.catalog} />
                        </li>
                      ))}
                      {canEdit ? (
                        <li className="mt-auto">
                          <Link href={`/practice/new?day=${d}`} className="flex items-center justify-center gap-1 py-1 text-[12.5px] text-dim hover:text-bone">
                            <Plus className="size-3" aria-hidden /> Add
                          </Link>
                        </li>
                      ) : null}
                    </ul>
                  </section>
                );
              })}
            </div>
          </>
        ) : data.list.length === 0 ? (
          <EmptyState title={view === "upcoming" ? "No sessions planned" : "No completed sessions yet"}>
            {view === "upcoming" ? "Plan the next practice from the button above." : "Mark sessions as completed and add their results."}
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.list.map((s) => (
              <li key={s.id}>
                <Link href={`/practice/${s.id}`} className="flex flex-col gap-1 border border-line bg-panel p-4 transition-colors hover:border-line-strong sm:flex-row sm:items-center sm:gap-6">
                  <p className="num w-[190px] shrink-0 text-[17px] text-bone">
                    {formatDay(s.local_day, { weekday: "short", month: "short", day: "numeric" })} · {s.local_time}
                  </p>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-bone">
                      {s.session_type}
                      {s.map_id ? ` · ${data.catalog.mapById.get(s.map_id)?.name}` : ""} {s.is_demo ? <DemoBadge className="ml-1 align-middle" /> : null}
                    </p>
                    <p className="truncate text-[13.5px] text-fog">{view === "completed" ? (s.outcome ?? "No results written") : (s.objective ?? "No objective set")}</p>
                  </div>
                  <p className="text-[13px] text-dim">
                    {formatDuration(s.duration_min)} · {s.attending_player_ids.length} players
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}

function SessionChip({ s, catalog }: { s: SessionRow; catalog: Catalog }) {
  return (
    <Link
      href={`/practice/${s.id}`}
      className={clsx(
        "block border-l-2 bg-raised px-2.5 py-2 text-[13px] transition-colors hover:bg-white/[0.06]",
        s.status === "completed" ? "border-win" : s.status === "cancelled" ? "border-dim opacity-60" : "border-accent",
      )}
    >
      <span className="num block text-[15px] text-bone">{s.local_time}</span>
      <span className="block font-semibold text-bone">{s.session_type}</span>
      {s.map_id ? <span className="block text-fog">{catalog.mapById.get(s.map_id)?.name}</span> : null}
      <span className="block text-dim">
        {SESSION_STATUS_LABEL[s.status]}
        {s.is_demo ? " · DEMO" : ""}
      </span>
    </Link>
  );
}
