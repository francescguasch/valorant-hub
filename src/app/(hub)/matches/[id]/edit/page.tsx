import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { getSettings } from "@/lib/data/settings";
import { withActor } from "@/lib/db";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { MatchForm } from "../../match-form";
import { loadMatchForm } from "../../load";

export const metadata: Metadata = { title: "Edit match" };

export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect(`/matches/${id}`);
  const settings = await getSettings();
  const data = await withActor(actorOf(viewer), (tx) => loadMatchForm(tx, settings.timezone, id));
  if (!data.found) notFound();
  return (
    <>
      <PageHeader title="Edit match" />
      <PageBody>
        <MatchForm {...data} />
      </PageBody>
    </>
  );
}
