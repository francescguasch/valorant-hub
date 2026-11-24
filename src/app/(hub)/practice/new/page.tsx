import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { getSettings } from "@/lib/data/settings";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { SessionForm } from "../session-form";
import { sessionOptions } from "../options";
import { todayIn, tzAbbrev } from "../load";

export const metadata: Metadata = { title: "Plan session" };

export default async function NewSessionPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day } = await searchParams;
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/practice");
  const settings = await getSettings();
  const o = await withActor(actorOf(viewer), (tx) => sessionOptions(tx));
  return (
    <>
      <PageHeader title="Plan a session" />
      <PageBody>
        <SessionForm
          maps={o.maps}
          strategies={o.strategies}
          players={o.players}
          tzLabel={tzAbbrev(settings.timezone)}
          initial={{
            day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : todayIn(settings.timezone),
            time: "19:00",
            duration_min: 120,
            session_type: "Strategy practice",
            map_id: "",
            strategy_id: "",
            objective: "",
            attending: o.players.map((p) => p.id),
            status: "planned",
            outcome: "",
            coach_notes: "",
            next_steps: "",
          }}
        />
      </PageBody>
    </>
  );
}
