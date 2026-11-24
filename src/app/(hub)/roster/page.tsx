import type { Metadata } from "next";
import { sectionAccess } from "@/lib/auth/viewer";
import { ComingNext } from "@/components/shell/coming-next";

export const metadata: Metadata = { title: "Roster" };

export default async function RosterPage() {
  await sectionAccess("roster");
  return (
    <ComingNext
      title="Roster"
      description="Player profiles, roles and agent pools."
      phase={3}
      items={['Profiles for Zach, JaxaPixel, Stryker, DoubleB and Justin', 'Photo, roles, main and secondary agents', 'Strengths and weaknesses', 'Individual stats from the match scoreboard', 'Personal goals and feedback history']}
    />
  );
}
