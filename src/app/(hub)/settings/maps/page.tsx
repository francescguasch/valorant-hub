/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { Panel } from "@/components/ui/panel";
import { SubmitButton } from "@/components/ui/form";
import { MapEditor, NewMapForm } from "../catalog-forms";
import { setRotation } from "../catalog-actions";

export const metadata: Metadata = { title: "Maps" };

export default async function MapsSettingsPage() {
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/settings/account");
  const { catalog, counts } = await withActor(actorOf(viewer), async (tx) => ({
    catalog: await loadCatalog(tx),
    counts: await tx<{ map_id: string; n: number }[]>`select map_id, count(*)::int as n from public.matches group by map_id`,
  }));
  const used = new Map(counts.map((c) => [c.map_id, c.n]));
  const pool = catalog.maps.filter((m) => m.in_rotation);
  const rest = catalog.maps.filter((m) => !m.in_rotation);

  const row = (m: (typeof catalog.maps)[number]) => (
    <li key={m.id} className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        {m.image ? <img src={m.image} alt="" className="h-10 w-24 object-cover" /> : <span className="h-10 w-24 bg-raised" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-bone">
            {m.name} {!m.active ? <span className="ml-1 text-[12px] font-normal text-dim">(hidden)</span> : null}
          </p>
          <p className="text-[13px] text-dim">{used.get(m.id) ?? 0} matches recorded</p>
        </div>
        <form action={setRotation}>
          <input type="hidden" name="id" value={m.id} />
          <input type="hidden" name="on" value={String(!m.in_rotation)} />
          <SubmitButton variant={m.in_rotation ? "ghost" : "secondary"} pendingLabel="Saving…">
            {m.in_rotation ? "Remove from pool" : "Add to pool"}
          </SubmitButton>
        </form>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-[13.5px] text-fog hover:text-bone">Edit details</summary>
        <div className="mt-3">
          <MapEditor map={{ ...m, matches: used.get(m.id) ?? 0 }} />
        </div>
      </details>
    </li>
  );

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Panel title="Active competitive pool" description="The maps your team plays now. The Map Playbook shows them first." bodyClassName="p-0">
        {pool.length ? <ul className="divide-y divide-line">{pool.map(row)}</ul> : <p className="px-5 py-4 text-dim">No maps in the pool yet. Add them from the list below.</p>}
      </Panel>
      <Panel title="Outside competitive rotation" bodyClassName="p-0">
        {rest.length ? <ul className="divide-y divide-line">{rest.map(row)}</ul> : <p className="px-5 py-4 text-dim">Every map is in the pool.</p>}
      </Panel>
      <Panel title="Add a map" description="For new maps Riot releases. Images load automatically when the name matches the official one.">
        <NewMapForm />
      </Panel>
    </div>
  );
}
