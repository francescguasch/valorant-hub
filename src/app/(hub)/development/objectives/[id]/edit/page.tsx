import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { ConfirmAction } from "@/components/ui/confirm";
import { ObjectiveForm } from "../../../forms";
import { deleteObjective } from "../../../actions";

export const metadata: Metadata = { title: "Edit objective" };

export default async function EditObjectivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/development?tab=objectives");
  const [o] = await withActor(actorOf(viewer), (tx) => tx<{ id: string; title: string; details: string | null; kind: string; progress: number; status: string; due_on: string | null }[]>`
    select id, title, details, kind, progress, status, due_on from public.team_objectives where id = ${id}`);
  if (!o) notFound();
  return (
    <>
      <PageHeader title="Edit objective" actions={<ConfirmAction action={deleteObjective} hidden={{ id }} label="Delete" confirmLabel="Delete objective" question="Delete this objective?" />} />
      <PageBody>
        <ObjectiveForm initial={{ id: o.id, title: o.title, details: o.details ?? "", kind: o.kind, progress: o.progress, status: o.status, due_on: o.due_on ?? "" }} />
      </PageBody>
    </>
  );
}
