import type { Metadata } from "next";
import { sectionAccess } from "@/lib/auth/viewer";
import { ComingNext } from "@/components/shell/coming-next";

export const metadata: Metadata = { title: "VOD Review" };

export default async function VodPage() {
  await sectionAccess("vod");
  return (
    <ComingNext
      title="VOD Review"
      description="A library of mistakes and lessons so they don't repeat."
      phase={3}
      items={['Review by match, map, round and timestamp', 'Video clip with embedded playback', 'Player involved and error category', 'What happened and what should have happened', 'Improvement action assigned to a player', 'Recurring mistakes over time']}
    />
  );
}
