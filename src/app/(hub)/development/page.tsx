import type { Metadata } from "next";
import { requireMember } from "@/lib/auth/viewer";
import { ComingNext } from "@/components/shell/coming-next";

export const metadata: Metadata = { title: "Player Development" };

export default async function DevelopmentPage() {
  await requireMember("/development");
  return (
    <ComingNext
      title="Player Development"
      description="Feedback and measurable goals for each player. Private feedback is visible only to that player and the staff."
      phase={3}
      items={[
        "Feedback by category: aim, positioning, game sense, comms and more",
        "Strengths, areas to improve and a specific example",
        "VOD clip, improvement action and follow-up date",
        "Personal goals with current level, target and progress",
        "Team objectives and staff priorities shown on the Overview",
        "Progress across weeks for each player",
      ]}
    />
  );
}
