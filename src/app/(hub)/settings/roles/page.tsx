import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { NewRoleForm, RoleEditor } from "../catalog-forms";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesSettingsPage() {
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/settings/account");
  const roles = await withActor(actorOf(viewer), (tx) => tx<{ id: string; name: string; players: number }[]>`
    select r.id, r.name, (select count(*) from public.players p where p.main_role_id = r.id or p.secondary_role_id = r.id)::int as players
    from public.team_roles r order by r.sort_order, r.name`);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Panel title="Team roles" description="The roles you assign to players in the Roster, for example Sentinel, Main Entry or IGL." bodyClassName="p-0">
        <ul className="divide-y divide-line">
          {roles.map((r) => (
            <li key={r.id} className="px-5 py-4">
              <RoleEditor role={r} players={r.players} />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Add a role">
        <NewRoleForm />
      </Panel>
    </div>
  );
}
