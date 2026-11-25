import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { actorOf, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { listBoards } from "@/lib/data/boards";
import { BoardStrip } from "@/components/boards/board-strip";
import { loadCatalog } from "@/lib/data/catalog";
import { formatDay, formatDuration } from "@/lib/format";
import { SESSION_STATUS_LABEL } from "@/lib/constants";
import { PageBody } from "@/components/shell/page-header";
import { DemoBadge, FormNotice, Panel } from "@/components/ui/panel";
import { buttonClass } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm";
import { sessionSelect, tzAbbrev, type SessionRow } from "../load";
import { deleteSession } from "../actions";

export const metadata: Metadata = { title: "Practice session" };

export default async function SessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { viewer, settings, canEdit } = await sectionAccess("practice");
  const { catalog, s, strategy, boards } = await withActor(actorOf(viewer), async (tx) => {
    const s = (await tx.unsafe<SessionRow[]>(`${sessionSelect(settings.timezone)} where id = $1`, [id]))[0];
    const strategy = s?.strategy_id ? (await tx<{ id: string; name: string }[]>`select id, name from public.strategies where id = ${s.strategy_id}`)[0] : undefined;
    return { catalog: await loadCatalog(tx), s, strategy, boards: s ? await listBoards(tx, { kind: "session", id }) : [] };
  });
  if (!s) notFound();
  const blocks: [string, string | null][] = [
    ["Objective", s.objective],
    ["Results", s.outcome],
    ["Coach notes", s.coach_notes],
    ["Next steps", s.next_steps],
  ];
  return (
    <>
      <header className="border-b border-line px-5 pb-6 pt-6 sm:px-8">
        <Link href={`/practice?week=${s.local_day}`} className="inline-flex items-center gap-1 text-[14px] text-fog hover:text-bone">
          <ChevronLeft className="size-4" aria-hidden /> Practice Planner
        </Link>
        <p className="mt-4 flex flex-wrap items-center gap-2 text-[14px] text-fog">
          {formatDay(s.local_day, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · {s.local_time} {tzAbbrev(settings.timezone)} · {formatDuration(s.duration_min)} · {SESSION_STATUS_LABEL[s.status]}
          {s.is_demo ? <DemoBadge /> : null}
        </p>
        <h1 className="type-display mt-2 text-[40px] font-extrabold text-bone sm:text-[52px]">
          {s.session_type}
          {s.map_id ? ` · ${catalog.mapById.get(s.map_id)?.name}` : ""}
        </h1>
        {canEdit ? (
          <div className="mt-5 flex flex-wrap items-start gap-2">
            <Link href={`/practice/${s.id}/edit`} className={buttonClass("secondary")}>
              <Pencil className="size-4" aria-hidden /> {s.status === "planned" ? "Edit or add results" : "Edit"}
            </Link>
            <ConfirmAction action={deleteSession} hidden={{ id: s.id }} label="Delete" confirmLabel="Delete session" question="Delete this session?" />
          </div>
        ) : null}
      </header>
      <PageBody>
        {saved ? <FormNotice>Session saved.</FormNotice> : null}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Panel title="Session">
            {blocks.some(([, v]) => v) ? (
              <dl className="flex flex-col gap-5">
                {blocks
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[13px] text-fog">{k}</dt>
                      <dd className="whitespace-pre-wrap text-bone">{v}</dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p className="text-dim">Nothing written yet.</p>
            )}
          </Panel>
          <div className="flex flex-col gap-5">
            <Panel title="Strategy">
              {strategy ? (
                <Link href={`/playbook/strategy/${strategy.id}`} className="text-bone underline underline-offset-4">
                  {strategy.name}
                </Link>
              ) : (
                <p className="text-dim">No specific strategy.</p>
              )}
            </Panel>
            <Panel title="Players attending">
              {s.attending_player_ids.length ? (
                <ul className="flex flex-wrap gap-2">
                  {s.attending_player_ids.map((p) => (
                    <li key={p} className="border border-line px-2.5 py-1 text-[14px] text-bone">
                      {catalog.playerById.get(p)?.nickname ?? "Former player"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-dim">Not set.</p>
              )}
            </Panel>
          </div>
        </div>
        <BoardStrip
          className="mt-5"
          boards={boards}
          canEdit={canEdit}
          newHref={`/boards/new?session=${id}`}
          description="The plans to drill in this session."
        />
      </PageBody>
    </>
  );
}
