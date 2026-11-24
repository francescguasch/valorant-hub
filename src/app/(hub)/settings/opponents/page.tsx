import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { Panel, DemoBadge } from "@/components/ui/panel";
import { NewOpponentForm, OpponentEditor } from "../catalog-forms";

export const metadata: Metadata = { title: "Opponents" };

export default async function OpponentsSettingsPage() {
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/settings/account");
  const opponents = await withActor(actorOf(viewer), (tx) => tx<
    { id: string; name: string; short_name: string | null; logo_url: string | null; is_demo: boolean; matches: number }[]
  >`select o.id, o.name, o.short_name, o.logo_url, o.is_demo,
           (select count(*) from public.matches m where m.opponent_id = o.id)::int as matches
    from public.opponents o order by lower(o.name)`);
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Panel
        title="Opponents"
        description="Opponents are created automatically when you record a match. Fix names here, or merge duplicates into one."
        bodyClassName="p-0"
      >
        {opponents.length === 0 ? (
          <p className="px-5 py-4 text-dim">No opponents yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {opponents.map((o) => (
              <li key={o.id} className="px-5 py-3">
                <details>
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <span className="font-semibold text-bone">{o.name}</span>
                    {o.is_demo ? <DemoBadge /> : null}
                    <span className="text-[13px] text-dim">{o.matches} matches</span>
                    <span className="ml-auto text-[13px] text-fog">Edit</span>
                  </summary>
                  <div className="mt-3">
                    <OpponentEditor opponent={o} others={opponents.filter((x) => x.id !== o.id).map((x) => ({ id: x.id, name: x.name }))} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Add an opponent" description="Useful to prepare scouting before the first match.">
        <NewOpponentForm />
      </Panel>
    </div>
  );
}
