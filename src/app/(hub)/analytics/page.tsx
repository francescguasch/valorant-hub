import type { Metadata } from "next";
import { sectionAccess } from "@/lib/auth/viewer";
import { ComingNext } from "@/components/shell/coming-next";

export const metadata: Metadata = { title: "Team Analytics" };

export default async function AnalyticsPage() {
  await sectionAccess("analytics");
  return (
    <ComingNext
      title="Team Analytics"
      description="Maps, compositions and matchups, with filters and sample-size warnings."
      phase={2}
      items={['Map analytics with T and CT side round win rates', 'Composition records and best maps', 'Composition versus composition matchups', 'Filters by map, opponent, date, competition and type', 'Pistol, anti-eco, bonus and first blood conversion', 'Warnings when a sample has fewer than 3 matches']}
    />
  );
}
