import type { Metadata } from "next";
import Link from "next/link";
import { actorOf, requireMember, ROLE_LABEL } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { MyPlayerForm, PasswordForm, ProfileForm, type MyPlayer } from "./account-forms";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const me = await requireMember("/settings/account");
  const playerId = me.playerId;
  const data = playerId
    ? await withActor(actorOf(me), async (tx) => ({
        player: (
          await tx<MyPlayer[]>`
            select p.nickname, coalesce(d.real_name, '') as real_name, coalesce(p.photo_url, '') as photo_url,
                   p.main_agent_ids, p.secondary_agent_ids
            from public.players p left join public.player_details d on d.player_id = p.id
            where p.id = ${playerId}`
        )[0],
        agents: await tx<{ id: string; name: string; role: string }[]>`
          select id, name, role::text as role from public.agents where active order by sort_order, name`,
      }))
    : null;

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      <Panel title="Profile" description={`${me.email} · ${ROLE_LABEL[me.role]}`}>
        <ProfileForm displayName={me.displayName} avatarUrl={me.avatarUrl ?? ""} userId={me.userId} />
      </Panel>
      <Panel title="Password">
        <PasswordForm />
      </Panel>
      {data?.player ? (
        <Panel
          id="player"
          title="Your player profile"
          description="What the team sees on the roster. Your role in the team and the staff's notes are set by the coaches."
          className="lg:col-span-2"
          action={
            <Link href={`/roster/${playerId}`} className="text-[14px] text-fog underline-offset-4 hover:text-bone hover:underline">
              View on roster
            </Link>
          }
        >
          <MyPlayerForm player={data.player} agents={data.agents} userId={me.userId} />
        </Panel>
      ) : null}
    </div>
  );
}
