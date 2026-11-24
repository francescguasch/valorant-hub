import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import type { Goal } from "@/lib/data/players";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { ConfirmAction } from "@/components/ui/confirm";
import { GoalForm } from "../../../forms";
import { developmentOptions } from "../../../options";
import { deleteGoal } from "../../../actions";

export const metadata: Metadata = { title: "Edit goal" };

export default async function EditGoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/development?tab=goals");
  const { o, g } = await withActor(actorOf(viewer), async (tx) => ({
    g: (await tx<Goal[]>`select * from public.player_goals where id = ${id}`)[0],
    o: await developmentOptions(tx),
  }));
  if (!g) notFound();
  return (
    <>
      <PageHeader title="Update goal" actions={<ConfirmAction action={deleteGoal} hidden={{ id }} label="Delete" confirmLabel="Delete goal" question="Delete this goal and its history?" />} />
      <PageBody>
        <GoalForm
          players={o.players}
          initial={{ id: g.id, player_id: g.player_id, description: g.description, current_level: g.current_level ?? "", target: g.target ?? "", deadline: g.deadline ?? "", progress: g.progress, status: g.status, comments: g.comments ?? "" }}
        />
      </PageBody>
    </>
  );
}
