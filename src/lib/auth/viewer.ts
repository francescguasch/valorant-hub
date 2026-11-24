import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "../supabase/server";
import { withActor, type Actor } from "../db";
import { getSettings } from "../data/settings";
import { sectionByKey, type SectionKey } from "../sections";

export type Role = "owner" | "coach" | "player";

export type Member = {
  kind: "member";
  userId: string;
  email: string;
  role: Role;
  displayName: string;
  playerId: string | null;
  avatarUrl: string | null;
};
export type Visitor = { kind: "visitor"; reason: "signed-out" | "no-access" };
export type Viewer = Member | Visitor;

/** Who is looking at this request. Resolved once per request. */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return { kind: "visitor", reason: "signed-out" };
  const email = (data.claims.email as string | undefined) ?? null;

  const rows = await withActor({ userId: sub, email }, (tx) => tx<
    { email: string; display_name: string; role: Role; player_id: string | null; avatar_url: string | null; disabled: boolean }[]
  >`select email, display_name, role, player_id, avatar_url, disabled from public.profiles where id = ${sub}`);
  const p = rows[0];
  if (!p || p.disabled) return { kind: "visitor", reason: "no-access" };

  return {
    kind: "member",
    userId: sub,
    email: p.email,
    role: p.role,
    displayName: p.display_name,
    playerId: p.player_id,
    avatarUrl: p.avatar_url,
  };
});

export const actorOf = (v: Viewer): Actor => (v.kind === "member" ? { userId: v.userId, email: v.email } : null);
export type StaffMember = Member & { role: "owner" | "coach" };
export type OwnerMember = Member & { role: "owner" };
export const isStaff = (v: Viewer): v is StaffMember => v.kind === "member" && (v.role === "owner" || v.role === "coach");
export const isOwner = (v: Viewer): v is OwnerMember => v.kind === "member" && v.role === "owner";

export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export async function requireMember(next = "/"): Promise<Member> {
  const viewer = await getViewer();
  if (viewer.kind !== "member") redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
  return viewer;
}

/**
 * Page-level access: members always; visitors only when the owner has opened
 * this section in Settings → Visitor access. Returns whether the viewer can edit.
 */
export async function sectionAccess(key: SectionKey) {
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  const section = sectionByKey(key);
  if (viewer.kind !== "member") {
    const open = section.publicable && settings.public_view_enabled && settings.public_sections.includes(key);
    if (!open) redirect(`/login?next=${encodeURIComponent(section.href)}`);
  }
  return { viewer, settings, canEdit: isStaff(viewer) };
}

export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", coach: "Coach / staff", player: "Player" };
