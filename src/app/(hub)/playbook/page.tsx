import type { Metadata } from "next";
import { sectionAccess } from "@/lib/auth/viewer";
import { ComingNext } from "@/components/shell/coming-next";

export const metadata: Metadata = { title: "Map Playbook" };

export default async function PlaybookPage() {
  await sectionAccess("playbook");
  return (
    <ComingNext
      title="Map Playbook"
      description="Every map in your pool with its callouts, team notes and T and CT side strategies."
      phase={2}
      items={['Map cards for the active rotation and the rest of the catalogue', 'Map overview: callouts, key areas, strengths and weaknesses', 'T side and CT side strategies by category', 'Assignments, utility, timing and step-by-step execution', 'Status: in development, practicing, approved', 'YouTube links and embedded playback']}
    />
  );
}
