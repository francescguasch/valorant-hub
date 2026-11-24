import type { Metadata } from "next";
import { sectionAccess } from "@/lib/auth/viewer";
import { ComingNext } from "@/components/shell/coming-next";

export const metadata: Metadata = { title: "Practice Planner" };

export default async function PracticePage() {
  await sectionAccess("practice");
  return (
    <ComingNext
      title="Practice Planner"
      description="The team's training calendar."
      phase={3}
      items={['Weekly calendar in Central time', 'Upcoming and completed sessions', 'Map, strategy, objective and attendance', 'Outcome, coach notes and next steps']}
    />
  );
}
