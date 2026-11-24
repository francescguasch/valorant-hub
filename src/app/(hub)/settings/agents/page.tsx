import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { AGENT_ROLE_LABEL, AGENT_ROLE_ORDER } from "@/lib/constants";
import { Panel } from "@/components/ui/panel";
import { AgentIcon } from "@/components/ui/agent";
import { AgentEditor, NewAgentForm } from "../catalog-forms";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsSettingsPage() {
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/settings/account");
  const { catalog, usedIds } = await withActor(actorOf(viewer), async (tx) => ({
    catalog: await loadCatalog(tx),
    usedIds: (await tx<{ id: string }[]>`select distinct unnest(our_agent_ids || opp_agent_ids) as id from public.matches`).map((r) => r.id),
  }));
  const used = new Set(usedIds);
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {AGENT_ROLE_ORDER.map((role) => (
        <Panel key={role} title={`${AGENT_ROLE_LABEL[role]}s`} bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {catalog.agents
              .filter((a) => a.role === role)
              .map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <details>
                    <summary className="flex cursor-pointer list-none items-center gap-3">
                      <AgentIcon name={a.name} image={a.image} size={32} />
                      <span className="font-semibold text-bone">{a.name}</span>
                      {!a.active ? <span className="text-[12px] text-dim">(hidden)</span> : null}
                      <span className="ml-auto text-[13px] text-fog">Edit</span>
                    </summary>
                    <div className="mt-3">
                      <AgentEditor agent={{ ...a, used: used.has(a.id) }} />
                    </div>
                  </details>
                </li>
              ))}
          </ul>
        </Panel>
      ))}
      <Panel title="Add an agent" description="When Riot releases a new agent, add it here so it can be picked in compositions.">
        <NewAgentForm />
      </Panel>
    </div>
  );
}
