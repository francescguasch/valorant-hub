import Link from "next/link";
import { Eye, FlaskConical } from "lucide-react";
import { actorOf, getViewer, isOwner, ROLE_LABEL } from "@/lib/auth/viewer";
import { getSettings } from "@/lib/data/settings";
import { withActor } from "@/lib/db";
import { SECTIONS, type SectionKey } from "@/lib/sections";
import { Sidebar, TeamBlock, UserBlock, type ShellUser } from "@/components/shell/sidebar";
import { MobileNav } from "@/components/shell/mobile-nav";

// Branding and access come from the database on every request.
export const dynamic = "force-dynamic";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);

  const locked: SectionKey[] =
    viewer.kind === "member"
      ? []
      : SECTIONS.filter(
          (s) => !(s.publicable && settings.public_view_enabled && settings.public_sections.includes(s.key)),
        ).map((s) => s.key);

  const user: ShellUser =
    viewer.kind === "member" ? { displayName: viewer.displayName, roleLabel: ROLE_LABEL[viewer.role] } : null;

  const hasDemo = isOwner(viewer)
    ? (await withActor(actorOf(viewer), (tx) => tx<{ demo: boolean }[]>`
        select exists (select 1 from public.matches where is_demo)
            or exists (select 1 from public.team_objectives where is_demo)
            or exists (select 1 from public.practice_sessions where is_demo) as demo`))[0]?.demo
    : false;

  return (
    <div
      className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]"
      style={{ "--accent": settings.accent_color, "--accent-2": settings.secondary_color } as React.CSSProperties}
    >
      <Sidebar settings={settings} user={user} locked={locked} />
      <div className="min-w-0">
        <MobileNav brand={<TeamBlock settings={settings} />} footer={<UserBlock user={user} />} locked={locked} />
        {viewer.kind !== "member" ? (
          <div className="flex items-center gap-2 border-b border-line bg-panel px-5 py-2.5 text-[13.5px] text-fog sm:px-8">
            <Eye className="size-4 shrink-0 text-accent" aria-hidden />
            <span>
              Read-only view.{" "}
              <Link href="/login" className="text-bone underline underline-offset-4">
                Sign in
              </Link>{" "}
              to add or edit team data.
            </span>
          </div>
        ) : null}
        {hasDemo ? (
          <div className="flex items-center gap-2 border-b border-demo/25 bg-demo/[0.06] px-5 py-2.5 text-[13.5px] text-fog sm:px-8">
            <FlaskConical className="size-4 shrink-0 text-demo" aria-hidden />
            <span>
              Demo data is loaded so you can try the platform. Remove it before entering real results in{" "}
              <Link href="/settings/data" className="text-bone underline underline-offset-4">
                Settings → Data
              </Link>
              .
            </span>
          </div>
        ) : null}
        <main id="main">{children}</main>
      </div>
    </div>
  );
}
