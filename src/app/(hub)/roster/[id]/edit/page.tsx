import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { getPlayer } from "@/lib/data/players";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { PlayerForm } from "../../player-form";

export const metadata: Metadata = { title: "Edit player" };

export default async function EditPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect(`/roster/${id}`);
  const { catalog, p } = await withActor(actorOf(viewer), async (tx) => ({ catalog: await loadCatalog(tx), p: await getPlayer(tx, id) }));
  if (!p) notFound();
  const used = new Set([...p.main_agent_ids, ...p.secondary_agent_ids]);
  return (
    <>
      <PageHeader title={`Edit ${p.nickname}`} />
      <PageBody>
        <PlayerForm
          roles={catalog.roles}
          agents={catalog.agents.filter((a) => a.active || used.has(a.id)).map(({ id: aid, name, role }) => ({ id: aid, name, role }))}
          initial={{
            id: p.id,
            nickname: p.nickname,
            real_name: p.real_name ?? "",
            photo_url: p.photo_url ?? "",
            main_role_id: p.main_role_id ?? "",
            secondary_role_id: p.secondary_role_id ?? "",
            main_agent_ids: p.main_agent_ids,
            secondary_agent_ids: p.secondary_agent_ids,
            strengths: p.strengths ?? "",
            weaknesses: p.weaknesses ?? "",
            notes: p.notes ?? "",
            active: p.active,
          }}
        />
      </PageBody>
    </>
  );
}
