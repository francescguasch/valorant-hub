import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { actorOf, getViewer, isStaff, ROLE_LABEL, type Role } from "@/lib/auth/viewer";
import { withActor } from "@/lib/db";
import { formatDay } from "@/lib/format";
import { Panel } from "@/components/ui/panel";
import { InviteForm, MemberActions, RevokeButton } from "./member-forms";

export const metadata: Metadata = { title: "Members" };

type Profile = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  player_id: string | null;
  disabled: boolean;
  last_seen: string | null;
};
type Invite = {
  id: string;
  code_hint: string;
  role: Role;
  player_id: string | null;
  email: string | null;
  note: string | null;
  expires_on: string;
};

export default async function MembersPage() {
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/settings/account");

  const { profiles, invites, players } = await withActor(actorOf(viewer), async (tx) => ({
    profiles: await tx<Profile[]>`
      select id, email, display_name, role, player_id, disabled, (last_seen_at at time zone 'UTC')::date::text as last_seen
      from public.profiles order by role, display_name`,
    invites: await tx<Invite[]>`
      select id, code_hint, role, player_id, email, note, (expires_at at time zone 'UTC')::date::text as expires_on
      from public.invitations where used_at is null and revoked_at is null and expires_at > now() order by created_at desc`,
    players: await tx<{ id: string; nickname: string }[]>`select id, nickname from public.players where active order by sort_order, nickname`,
  }));

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const playerName = new Map(players.map((p) => [p.id, p.nickname]));
  const isOwnerViewer = viewer.role === "owner";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-6">
        <Panel
          title="Members"
          description={
            isOwnerViewer
              ? "Change roles, link accounts to roster players, reset passwords or block access."
              : "Coaches can create password reset codes for players. Only the owner changes roles and access."
          }
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-line">
            {profiles.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-bone">
                    {p.display_name}
                    {p.id === viewer.userId ? <span className="text-[12px] font-normal text-fog">(you)</span> : null}
                    {p.disabled ? <span className="border border-loss/50 px-1.5 text-[11px] font-bold text-loss">BLOCKED</span> : null}
                  </p>
                  <p className="truncate text-[13.5px] text-fog">{p.email}</p>
                  <p className="text-[13px] text-dim">
                    {ROLE_LABEL[p.role]}
                    {p.player_id ? ` · Roster: ${playerName.get(p.player_id) ?? "—"}` : ""}
                    {p.last_seen ? ` · Last seen ${formatDay(p.last_seen)}` : ""}
                  </p>
                </div>
                <MemberActions
                  member={{ id: p.id, role: p.role, player_id: p.player_id, disabled: p.disabled, isSelf: p.id === viewer.userId }}
                  players={players}
                  canManage={isOwnerViewer}
                  canReset={isOwnerViewer || p.role === "player"}
                />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Pending invitations" description="Codes not used yet. The code itself is only shown once, when it's created." bodyClassName="p-0">
          {invites.length === 0 ? (
            <p className="px-5 py-4 text-[14px] text-dim">No pending invitations.</p>
          ) : (
            <ul className="divide-y divide-line">
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="font-display text-[17px] tracking-[0.1em] text-bone">••••-••••-{i.code_hint}</p>
                    <p className="text-[13px] text-fog">
                      {ROLE_LABEL[i.role]}
                      {i.player_id ? ` · ${playerName.get(i.player_id)}` : ""}
                      {i.email ? ` · ${i.email}` : ""}
                      {i.note ? ` · ${i.note}` : ""} · Expires {formatDay(i.expires_on)}
                    </p>
                  </div>
                  {isOwnerViewer || i.role === "player" ? <RevokeButton id={i.id} /> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Invite someone" description="Create a code and send it privately. It works once." className="self-start">
        <InviteForm
          players={players.filter((pl) => !profiles.some((pr) => pr.player_id === pl.id))}
          canInviteStaff={isOwnerViewer}
          origin={origin}
        />
      </Panel>
    </div>
  );
}
