import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { VodForm } from "../../vod-form";
import { VOD_SELECT, vodOptions, type VodRow } from "../../load";

export const metadata: Metadata = { title: "Edit review" };

export default async function EditVodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect(`/vod/${id}`);
  const { o, r } = await withActor(actorOf(viewer), async (tx) => ({ o: await vodOptions(tx), r: (await tx.unsafe<VodRow[]>(`${VOD_SELECT} where id = $1`, [id]))[0] }));
  if (!r) notFound();
  const s = (v: string | number | null) => (v === null ? "" : String(v));
  return (
    <>
      <PageHeader title="Edit VOD review" />
      <PageBody>
        <VodForm
          matches={o.matches}
          maps={o.maps}
          players={o.players}
          initial={{ id: r.id, match_id: s(r.match_id), map_id: s(r.map_id), round_number: s(r.round_number), video_timestamp: s(r.video_timestamp), clip_url: s(r.clip_url), player_id: s(r.player_id), category: s(r.category), what_happened: r.what_happened, should_have_happened: s(r.should_have_happened), improvement_action: s(r.improvement_action), assigned_player_id: s(r.assigned_player_id), status: r.status, hasTask: Boolean(r.feedback_id) }}
        />
      </PageBody>
    </>
  );
}
