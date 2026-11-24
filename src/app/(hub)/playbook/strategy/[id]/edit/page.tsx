import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { getStrategy } from "@/lib/data/playbook";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { FormNotice } from "@/components/ui/panel";
import { StrategyForm } from "../../../forms";
import { strategyFormOptions, toInitial } from "../../../form-data";

export const metadata: Metadata = { title: "Edit strategy" };

export default async function EditStrategyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copied?: string }> }) {
  const { id } = await params;
  const { copied } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect(`/playbook/strategy/${id}`);
  const { catalog, strategy } = await withActor(actorOf(viewer), async (tx) => ({ catalog: await loadCatalog(tx), strategy: await getStrategy(tx, id) }));
  if (!strategy) notFound();
  return (
    <>
      <PageHeader title={copied ? "Edit the copy" : "Edit strategy"} />
      <PageBody>
        {copied ? <FormNotice>Strategy duplicated. Rename it and adjust what changes.</FormNotice> : null}
        <StrategyForm {...strategyFormOptions(catalog, strategy)} initial={toInitial(strategy)} />
      </PageBody>
    </>
  );
}
