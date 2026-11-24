import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { GoalForm } from "../../forms";
import { developmentOptions } from "../../options";

export const metadata: Metadata = { title: "Add goal" };

export default async function NewGoalPage({ searchParams }: { searchParams: Promise<{ player?: string }> }) {
  const { player } = await searchParams;
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/development?tab=goals");
  const o = await withActor(actorOf(viewer), (tx) => developmentOptions(tx));
  return (
    <>
      <PageHeader title="Add goal" description="Measurable goals work best: a current level, a target and a deadline." />
      <PageBody>
        <GoalForm
          players={o.players}
          initial={{ player_id: player && /^[0-9a-f-]{36}$/.test(player) ? player : "", description: "", current_level: "", target: "", deadline: "", progress: 0, status: "in_progress", comments: "" }}
        />
      </PageBody>
    </>
  );
}
