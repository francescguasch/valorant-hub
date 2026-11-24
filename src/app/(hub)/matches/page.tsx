import type { Metadata } from "next";
import { sectionAccess } from "@/lib/auth/viewer";
import { ComingNext } from "@/components/shell/coming-next";

export const metadata: Metadata = { title: "Match Center" };

export default async function MatchesPage() {
  await sectionAccess("matches");
  return (
    <ComingNext
      title="Match Center"
      description="Every map played, scrims and official matches, with scores calculated automatically."
      phase={2}
      items={['Add new match form with five-agent pickers per team', 'T, CT and overtime rounds with automatic score and result', 'Series id to rebuild BO1, BO3 and BO5 results', 'Optional pistol, anti-eco, bonus and first blood numbers', 'Per-player scoreboard: K/D/A, ACS, ADR, HS%, first kills', 'Edit and delete with confirmation, CSV and Excel export']}
    />
  );
}
