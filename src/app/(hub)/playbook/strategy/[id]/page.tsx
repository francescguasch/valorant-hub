import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Copy, Pencil } from "lucide-react";
import { actorOf, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { compAgents, loadCatalog } from "@/lib/data/catalog";
import { getStrategy } from "@/lib/data/playbook";
import { boardsFor } from "@/lib/data/boards";
import { BoardStrip } from "@/components/boards/board-strip";
import { SIDE_LABEL, categoryLabel } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { PageBody } from "@/components/shell/page-header";
import { DemoBadge, FormNotice, Panel } from "@/components/ui/panel";
import { AgentIcon, Comp } from "@/components/ui/agent";
import { buttonClass } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm";
import { VideoBlock } from "@/components/ui/youtube";
import { StatusBadge } from "@/components/playbook/status-badge";
import { deleteStrategy, duplicateStrategy, setArchived } from "../../actions";

export const metadata: Metadata = { title: "Strategy" };

export default async function StrategyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { viewer, canEdit } = await sectionAccess("playbook");
  const { catalog, s, boards } = await withActor(actorOf(viewer), async (tx) => ({
    catalog: await loadCatalog(tx),
    s: await getStrategy(tx, id),
    boards: await boardsFor(tx, { kind: "strategy", id }),
  }));
  if (!s) notFound();
  const map = catalog.mapById.get(s.map_id);
  const assignments = Array.isArray(s.assignments) ? s.assignments : [];
  const steps = (s.execution ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  const blocks: [string, string | null][] = [
    ["Description", s.description],
    ["Objective", s.objective],
    ["Starting positions", s.starting_positions],
    ["Utility usage", s.utility_usage],
    ["Timing", s.timing],
    ["Callouts", s.callouts],
    ["Alternative plans", s.alternatives],
    ["Common mistakes", s.common_mistakes],
    ["Coaching notes", s.coaching_notes],
  ];

  return (
    <>
      <header className="border-b border-line px-5 pb-6 pt-6 sm:px-8">
        <Link href={`/playbook/${s.map_id}?tab=${s.side}`} className="inline-flex items-center gap-1 text-[14px] text-fog hover:text-bone">
          <ChevronLeft className="size-4" aria-hidden /> {map?.name} · {SIDE_LABEL[s.side]}
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[14px] text-fog">
          {categoryLabel(s.side, s.category)} <StatusBadge status={s.status} />
          {s.archived_at ? <span className="border border-line-strong px-1.5 text-[11.5px] text-fog">Archived</span> : null}
          {s.is_demo ? <DemoBadge /> : null}
          <span className="text-dim">· Updated {formatDay(s.updated_at.slice(0, 10))}</span>
        </div>
        <h1 className="type-display mt-2 text-[40px] font-extrabold text-bone sm:text-[52px]">{s.name}</h1>
        {canEdit ? (
          <div className="mt-5 flex flex-wrap items-start gap-2">
            <Link href={`/playbook/strategy/${s.id}/edit`} className={buttonClass("secondary")}>
              <Pencil className="size-4" aria-hidden /> Edit
            </Link>
            <ConfirmAction action={duplicateStrategy} hidden={{ id: s.id }} label={<><Copy className="size-4" aria-hidden /> Duplicate</>} confirmLabel="Duplicate" question="Make a copy to adapt?" variant="secondary" />
            <ConfirmAction
              action={setArchived}
              hidden={{ id: s.id, archive: String(!s.archived_at) }}
              label={s.archived_at ? "Restore" : "Archive"}
              confirmLabel={s.archived_at ? "Restore" : "Archive"}
              question={s.archived_at ? "Show it in the playbook again?" : "Hide it from the playbook lists?"}
              variant="secondary"
            />
            <ConfirmAction action={deleteStrategy} hidden={{ id: s.id }} label="Delete" confirmLabel="Delete strategy" question="Delete permanently? Archive keeps it instead." />
          </div>
        ) : null}
      </header>
      <PageBody>
        {saved ? <FormNotice>Strategy saved.</FormNotice> : null}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            <BoardStrip
              boards={boards.boards}
          catalog={boards.catalog}
              canEdit={canEdit}
              newHref={`/boards/new?strategy=${s.id}`}
              description="The plan drawn on the map: positions, utility and routes."
            />
            {steps.length ? (
              <Panel title="Round execution">
                <ol className="flex flex-col gap-3">
                  {steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="num grid size-7 shrink-0 place-items-center bg-accent text-[15px] font-bold text-white">{i + 1}</span>
                      <span className="pt-0.5 text-bone">{step}</span>
                    </li>
                  ))}
                </ol>
              </Panel>
            ) : null}
            <Panel title="Plan">
              {blocks.some(([, v]) => v) ? (
                <dl className="grid gap-6 lg:grid-cols-2">
                  {blocks
                    .filter(([, v]) => v)
                    .map(([label, value]) => (
                      <div key={label}>
                        <dt className="type-display mb-1.5 text-[16px] font-bold text-bone">{label}</dt>
                        <dd className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-fog">{value}</dd>
                      </div>
                    ))}
                </dl>
              ) : (
                <p className="text-dim">No details written yet.</p>
              )}
            </Panel>
            {s.youtube_url ? (
              <Panel title="Video">
                <VideoBlock url={s.youtube_url} title={s.name} />
              </Panel>
            ) : null}
          </div>
          <div className="flex flex-col gap-5">
            <Panel title="Composition">
              {s.comp_agent_ids.length ? (
                <div className="flex flex-col gap-2">
                  <Comp agents={compAgents(catalog, s.comp_agent_ids)} size={40} />
                  <p className="text-[14px] text-fog">{compAgents(catalog, s.comp_agent_ids).map((a) => a.name).join(" · ")}</p>
                </div>
              ) : (
                <p className="text-dim">Works with any composition.</p>
              )}
            </Panel>
            <Panel title="Player assignments" bodyClassName="p-0">
              {assignments.length ? (
                <ul className="divide-y divide-line">
                  {assignments.map((a, i) => {
                    const agent = a.agent_id ? catalog.agentById.get(a.agent_id) : null;
                    return (
                      <li key={i} className="flex items-start gap-3 px-5 py-3">
                        {agent ? <AgentIcon name={agent.name} image={agent.image} size={32} /> : <span className="size-8 shrink-0 bg-raised" />}
                        <div className="min-w-0">
                          <p className="font-semibold text-bone">
                            {a.player_id ? catalog.playerById.get(a.player_id)?.nickname : "Any player"}
                            {agent ? <span className="font-normal text-fog"> · {agent.name}</span> : null}
                          </p>
                          {a.task ? <p className="text-[14px] text-fog">{a.task}</p> : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-5 py-4 text-dim">No assignments yet.</p>
              )}
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
