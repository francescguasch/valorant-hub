import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { PlayerForm } from "../player-form";

export const metadata: Metadata = { title: "Add player" };

export default async function NewPlayerPage() {
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/roster");
  const catalog = await withActor(actorOf(viewer), (tx) => loadCatalog(tx));
  return (
    <>
      <PageHeader title="Add player" description="Only the nickname is required." />
      <PageBody>
        <PlayerForm
          roles={catalog.roles}
          agents={catalog.agents.filter((a) => a.active).map(({ id, name, role }) => ({ id, name, role }))}
          initial={{ nickname: "", real_name: "", photo_url: "", main_role_id: "", secondary_role_id: "", main_agent_ids: [], secondary_agent_ids: [], strengths: "", weaknesses: "", notes: "", active: true }}
        />
      </PageBody>
    </>
  );
}
