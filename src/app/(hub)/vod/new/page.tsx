import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { VodForm } from "../vod-form";
import { vodOptions } from "../load";

export const metadata: Metadata = { title: "Add review" };

export default async function NewVodPage({ searchParams }: { searchParams: Promise<{ match?: string }> }) {
  const { match } = await searchParams;
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/vod");
  const o = await withActor(actorOf(viewer), (tx) => vodOptions(tx));
  return (
    <>
      <PageHeader title="Add VOD review" />
      <PageBody>
        <VodForm
          matches={o.matches}
          maps={o.maps}
          players={o.players}
          initial={{ match_id: match && /^[0-9a-f-]{36}$/.test(match) ? match : "", map_id: "", round_number: "", video_timestamp: "", clip_url: "", player_id: "", category: "", what_happened: "", should_have_happened: "", improvement_action: "", assigned_player_id: "", status: "open" }}
        />
      </PageBody>
    </>
  );
}
