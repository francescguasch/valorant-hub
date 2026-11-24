import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import type { Feedback } from "@/lib/data/players";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { ConfirmAction } from "@/components/ui/confirm";
import { FeedbackForm } from "../../../forms";
import { developmentOptions } from "../../../options";
import { deleteFeedback } from "../../../actions";

export const metadata: Metadata = { title: "Edit feedback" };

export default async function EditFeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/development");
  const { o, f } = await withActor(actorOf(viewer), async (tx) => ({
    f: (await tx<Feedback[]>`select * from public.feedback where id = ${id}`)[0],
    o: await developmentOptions(tx),
  }));
  if (!f) notFound();
  const s = (v: string | null) => v ?? "";
  return (
    <>
      <PageHeader title="Edit feedback" actions={<ConfirmAction action={deleteFeedback} hidden={{ id }} label="Delete" confirmLabel="Delete feedback" question="Delete this feedback?" />} />
      <PageBody>
        <FeedbackForm
          players={o.players}
          matches={o.matches}
          sessions={o.sessions}
          initial={{
            id: f.id,
            player_id: f.player_id,
            given_on: f.given_on,
            category: f.category,
            status: f.status,
            match_id: s(f.match_id),
            practice_session_id: s(f.practice_session_id),
            strengths: s(f.strengths),
            areas_to_improve: s(f.areas_to_improve),
            specific_example: s(f.specific_example),
            evidence: s(f.evidence),
            vod_clip_url: s(f.vod_clip_url),
            improvement_action: s(f.improvement_action),
            follow_up_on: s(f.follow_up_on),
          }}
        />
      </PageBody>
    </>
  );
}
