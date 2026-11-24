import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { getMapNotes } from "@/lib/data/playbook";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { MapNotesForm } from "../../forms";

export const metadata: Metadata = { title: "Map notes" };

export default async function MapNotesPage({ params }: { params: Promise<{ mapId: string }> }) {
  const { mapId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(mapId)) notFound();
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect(`/playbook/${mapId}`);
  const { catalog, notes } = await withActor(actorOf(viewer), async (tx) => ({ catalog: await loadCatalog(tx), notes: await getMapNotes(tx, mapId) }));
  const map = catalog.mapById.get(mapId);
  if (!map) notFound();
  const t = (v: string | null | undefined) => v ?? "";
  return (
    <>
      <PageHeader title={`${map.name} notes`} description="What the team should know about this map." />
      <PageBody>
        <MapNotesForm
          initial={{
            map_id: map.id,
            overview: t(notes?.overview),
            characteristics: t(notes?.characteristics),
            important_areas: t(notes?.important_areas),
            callouts: t(notes?.callouts),
            strengths: t(notes?.strengths),
            weaknesses: t(notes?.weaknesses),
            recommended_comps: t(notes?.recommended_comps),
            callouts_image_url: t(notes?.callouts_image_url),
          }}
        />
      </PageBody>
    </>
  );
}
