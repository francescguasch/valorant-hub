import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { categoriesFor } from "@/lib/constants";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { StrategyForm } from "../../forms";
import { strategyFormOptions } from "../../form-data";

export const metadata: Metadata = { title: "New strategy" };

export default async function NewStrategyPage({
  params,
  searchParams,
}: {
  params: Promise<{ mapId: string }>;
  searchParams: Promise<{ side?: string; category?: string }>;
}) {
  const { mapId } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(mapId)) notFound();
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect(`/playbook/${mapId}`);
  const catalog = await withActor(actorOf(viewer), (tx) => loadCatalog(tx));
  const map = catalog.mapById.get(mapId);
  if (!map) notFound();
  const side = sp.side === "ct" ? "ct" : "t";
  const category = categoriesFor(side).some((c) => c.value === sp.category) ? sp.category! : categoriesFor(side)[0]!.value;
  return (
    <>
      <PageHeader title={`New ${map.name} strategy`} description="Only the name is required. Fill in the rest as the plan takes shape." />
      <PageBody>
        <StrategyForm
          {...strategyFormOptions(catalog)}
          initial={{
            map_id: map.id,
            side,
            category,
            name: "",
            status: "in_development",
            description: "",
            objective: "",
            comp_agent_ids: [],
            assignments: [],
            starting_positions: "",
            utility_usage: "",
            timing: "",
            callouts: "",
            execution: "",
            strong_points: "",
            weak_points: "",
            youtube_url: "",
          }}
        />
      </PageBody>
    </>
  );
}
