import type { Metadata } from "next";
import { sectionAccess } from "@/lib/auth/viewer";
import { ComingNext } from "@/components/shell/coming-next";

export const metadata: Metadata = { title: "Opponent Scouting" };

export default async function ScoutingPage() {
  await sectionAccess("scouting");
  return (
    <ComingNext
      title="Opponent Scouting"
      description="History and notes for every team you've played."
      phase={2}
      items={['Opponents created automatically from Match Center', 'Record, round difference and maps against each rival', 'Their compositions against you, and yours against them', 'Results history and last meeting', 'Scouting notes to prepare the next match']}
    />
  );
}
