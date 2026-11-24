import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { getSettings } from "@/lib/data/settings";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { SessionForm } from "../../session-form";
import { sessionOptions } from "../../options";
import { sessionSelect, tzAbbrev, type SessionRow } from "../../load";

export const metadata: Metadata = { title: "Edit session" };

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect(`/practice/${id}`);
  const settings = await getSettings();
  const { o, s } = await withActor(actorOf(viewer), async (tx) => ({
    o: await sessionOptions(tx),
    s: (await tx.unsafe<SessionRow[]>(`${sessionSelect(settings.timezone)} where id = $1`, [id]))[0],
  }));
  if (!s) notFound();
  const t = (v: string | null) => v ?? "";
  return (
    <>
      <PageHeader title="Edit session" />
      <PageBody>
        <SessionForm
          maps={o.maps}
          strategies={o.strategies}
          players={o.players}
          tzLabel={tzAbbrev(settings.timezone)}
          initial={{ id: s.id, day: s.local_day, time: s.local_time, duration_min: s.duration_min, session_type: s.session_type, map_id: t(s.map_id), strategy_id: t(s.strategy_id), objective: t(s.objective), attending: s.attending_player_ids, status: s.status, outcome: t(s.outcome), coach_notes: t(s.coach_notes), next_steps: t(s.next_steps) }}
        />
      </PageBody>
    </>
  );
}
