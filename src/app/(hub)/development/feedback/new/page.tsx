import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { FeedbackForm } from "../../forms";
import { developmentOptions, todayUTC } from "../../options";

export const metadata: Metadata = { title: "Add feedback" };

export default async function NewFeedbackPage({ searchParams }: { searchParams: Promise<{ player?: string; match?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/development");
  const o = await withActor(actorOf(viewer), (tx) => developmentOptions(tx));
  const valid = (id?: string) => (id && /^[0-9a-f-]{36}$/.test(id) ? id : "");
  return (
    <>
      <PageHeader title="Add feedback" />
      <PageBody>
        <FeedbackForm
          players={o.players}
          matches={o.matches}
          sessions={o.sessions}
          initial={{ player_id: valid(sp.player), given_on: todayUTC(), category: "", status: "open", match_id: valid(sp.match), practice_session_id: "", strengths: "", areas_to_improve: "", specific_example: "", evidence: "", vod_clip_url: "", improvement_action: "", follow_up_on: "" }}
        />
      </PageBody>
    </>
  );
}
