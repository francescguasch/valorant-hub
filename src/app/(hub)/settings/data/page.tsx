import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { actorOf, getViewer, isOwner } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { ConfirmAction } from "@/components/ui/confirm";
import { setDemoData } from "../actions";
import { buttonClass } from "@/components/ui/button";
import { Download } from "lucide-react";

export const metadata: Metadata = { title: "Data" };

export default async function DataPage() {
  const viewer = await getViewer();
  if (!isOwner(viewer)) redirect("/settings/account");
  const [counts] = await withActor(actorOf(viewer), (tx) => tx<{ matches: number; objectives: number; sessions: number; opponents: number }[]>`
    select (select count(*) from public.matches where is_demo)::int as matches,
           (select count(*) from public.team_objectives where is_demo)::int as objectives,
           (select count(*) from public.practice_sessions where is_demo)::int as sessions,
           (select count(*) from public.opponents where is_demo)::int as opponents`);
  const total = counts!.matches + counts!.objectives + counts!.sessions + counts!.opponents;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Panel title="Demo data" description="Fictional records, marked DEMO, so the platform can be tried before real results exist.">
        {total > 0 ? (
          <>
            <p className="text-fog">
              Loaded now: {counts!.matches} matches against {counts!.opponents} opponents, {counts!.objectives} objectives
              and {counts!.sessions} practice sessions. None of it is linked to real players.
            </p>
            <ConfirmAction
              className="mt-4"
              action={setDemoData}
              hidden={{ mode: "clear" }}
              label="Remove demo data"
              confirmLabel="Remove all demo data"
              question="Delete every DEMO record? Real records stay."
            />
          </>
        ) : (
          <>
            <p className="text-fog">No demo data is loaded. Your hub shows only real records.</p>
            <ConfirmAction
              className="mt-4"
              action={setDemoData}
              hidden={{ mode: "load" }}
              label="Load demo data"
              confirmLabel="Load demo data"
              question="Add fictional DEMO records?"
              variant="secondary"
            />
          </>
        )}
      </Panel>

      <Panel title="Export" description="Download your data. Each file contains only what your account can see.">
        <div className="flex flex-wrap gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from a route handler */}
          <a href="/export/all?format=xlsx" className={buttonClass("primary")}>
            <Download className="size-4" aria-hidden /> Everything (Excel)
          </a>
          {[
            ["matches", "Matches"],
            ["player-stats", "Player stats"],
            ["opponents", "Opponents"],
            ["strategies", "Strategies"],
            ["practice", "Practice"],
            ["vod", "VOD reviews"],
          ].map(([key, label]) => (
            <a key={key} href={`/export/${key}?format=csv`} className={buttonClass("secondary")}>
              {label} (CSV)
            </a>
          ))}
        </div>
      </Panel>

      <Panel title="Backups">
        <p className="text-fog">
          Supabase keeps daily backups of the database on paid plans only. On the free plan, follow the backup steps in
          the setup guide (docs/SETUP.es.md, section 8) once a week: it saves a complete copy of the database to a file
          you keep.
        </p>
      </Panel>
    </div>
  );
}
