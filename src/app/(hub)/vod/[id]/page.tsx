import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { actorOf, isStaff, sectionAccess } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { listBoards } from "@/lib/data/boards";
import { BoardStrip } from "@/components/boards/board-strip";
import { loadCatalog } from "@/lib/data/catalog";
import { FEEDBACK_STATUS_LABEL } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import { PageBody } from "@/components/shell/page-header";
import { DemoBadge, FormNotice, Panel } from "@/components/ui/panel";
import { buttonClass } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm";
import { VideoBlock, parseYouTube } from "@/components/ui/youtube";
import { VOD_SELECT, toSeconds, type VodRow } from "../load";
import { deleteVod } from "../actions";

export const metadata: Metadata = { title: "VOD review" };

export default async function VodDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; task?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { viewer, canEdit } = await sectionAccess("vod");
  const data = await withActor(actorOf(viewer), async (tx) => {
    const r = (await tx.unsafe<VodRow[]>(`${VOD_SELECT} where id = $1`, [id]))[0];
    const vod = r?.match_id
      ? (await tx<{ vod_url: string | null }[]>`select vod_url from public.match_notes where match_id = ${r.match_id}`)[0]?.vod_url ?? null
      : null;
    return { catalog: await loadCatalog(tx), r, vod, boards: r ? await listBoards(tx, { kind: "vod", id }) : [] };
  });
  if (!data.r) notFound();
  const { r, catalog, boards } = data;

  // Prefer the clip; otherwise open the match VOD at the timestamp.
  let video = r.clip_url;
  if (!video && data.vod) {
    const yt = parseYouTube(data.vod);
    video = yt ? `https://www.youtube.com/watch?v=${yt.id}&t=${toSeconds(r.video_timestamp) || yt.start}` : data.vod;
  }
  const rows: [string, string | null][] = [
    ["What happened", r.what_happened],
    ["What should have happened", r.should_have_happened],
    ["Solution / improvement action", r.improvement_action],
  ];

  return (
    <>
      <header className="border-b border-line px-5 pb-6 pt-6 sm:px-8">
        <Link href="/vod" className="inline-flex items-center gap-1 text-[14px] text-fog hover:text-bone">
          <ChevronLeft className="size-4" aria-hidden /> VOD Review
        </Link>
        <p className="mt-4 flex flex-wrap items-center gap-2 text-[14px] text-fog">
          {r.category ?? "Uncategorised"} · {FEEDBACK_STATUS_LABEL[r.status]} · {formatDay(r.created_on)} {r.is_demo ? <DemoBadge /> : null}
        </p>
        <h1 className="type-display mt-2 text-[40px] font-extrabold text-bone sm:text-[48px]">
          {r.player_id ? catalog.playerById.get(r.player_id)?.nickname : "Team"}
          {r.map_id ? ` · ${catalog.mapById.get(r.map_id)?.name}` : ""}
          {r.round_number ? ` · R${r.round_number}` : ""}
        </h1>
        {canEdit ? (
          <div className="mt-5 flex flex-wrap items-start gap-2">
            <Link href={`/vod/${r.id}/edit`} className={buttonClass("secondary")}>
              <Pencil className="size-4" aria-hidden /> Edit
            </Link>
            <ConfirmAction action={deleteVod} hidden={{ id: r.id }} label="Delete" confirmLabel="Delete review" question="Delete this review?" />
          </div>
        ) : null}
      </header>
      <PageBody>
        {sp.saved ? <FormNotice>Review saved.{sp.task ? " An improvement task was added to Player Development." : ""}</FormNotice> : null}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel title="Video" description={r.video_timestamp ? `Timestamp ${r.video_timestamp}` : undefined}>
            {video ? <VideoBlock url={video} title="VOD review clip" /> : <p className="text-dim">No clip or match VOD linked.</p>}
          </Panel>
          <Panel title="Analysis">
            <dl className="flex flex-col gap-5">
              {rows
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[13px] text-fog">{k}</dt>
                    <dd className="whitespace-pre-wrap text-bone">{v}</dd>
                  </div>
                ))}
              {r.assigned_player_id ? (
                <div>
                  <dt className="text-[13px] text-fog">Assigned to</dt>
                  <dd className="text-bone">{catalog.playerById.get(r.assigned_player_id)?.nickname}</dd>
                </div>
              ) : null}
              {r.match_id ? (
                <div>
                  <dt className="text-[13px] text-fog">Match</dt>
                  <dd>
                    <Link href={`/matches/${r.match_id}`} className="text-bone underline underline-offset-4">
                      Open the match
                    </Link>
                  </dd>
                </div>
              ) : null}
              {r.feedback_id && (isStaff(viewer) || (viewer.kind === "member" && viewer.playerId === r.assigned_player_id)) ? (
                <div>
                  <dt className="text-[13px] text-fog">Improvement task</dt>
                  <dd className="text-bone">Created in Player Development.</dd>
                </div>
              ) : null}
            </dl>
          </Panel>
        </div>
        <BoardStrip
          className="mt-5"
          boards={boards}
          canEdit={canEdit}
          newHref={`/boards/new?vod=${id}`}
          description="What happened and what should have happened, drawn on the map."
        />
      </PageBody>
    </>
  );
}
