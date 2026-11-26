import Link from "next/link";
import { Bell, LogIn, LogOut } from "lucide-react";
import type { SectionKey } from "@/lib/sections";
import type { TeamSettings } from "@/lib/data/settings";
import { NavLinks } from "./nav";
import { TeamMark } from "./team-mark";
import { buttonClass } from "../ui/button";

export type ShellUser = {
  displayName: string;
  roleLabel: string;
  notices: number;
  avatarUrl: string | null;
} | null;

export function TeamBlock({ settings }: { settings: TeamSettings }) {
  return (
    <Link href="/" className="flex items-center gap-3 px-5 py-5">
      <TeamMark name={settings.university_name} logoUrl={settings.logo_url} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[12.5px] text-fog">{settings.university_name}</span>
        <span className="type-display block truncate text-[17px] font-bold text-bone">{settings.team_name}</span>
      </span>
    </Link>
  );
}

export function NoticeBell({ count }: { count: number }) {
  const label = count ? `${count} notification${count === 1 ? "" : "s"}` : "Notifications";
  return (
    <Link
      href="/notifications"
      className="relative grid size-9 shrink-0 place-items-center text-fog transition-colors hover:bg-white/[0.04] hover:text-bone"
      title={label}
    >
      <Bell className="size-[18px]" aria-hidden />
      <span className="sr-only">{label}</span>
      {count ? (
        <span className="num absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}

export function UserBlock({ user, showcase = false }: { user: ShellUser; showcase?: boolean }) {
  if (!user && showcase) {
    return (
      <div className="border-t border-line p-4">
        <p className="text-[13px] text-fog">Portfolio showcase. Fictional team and data, read-only.</p>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="border-t border-line p-4">
        <p className="mb-3 text-[13px] text-fog">You&apos;re viewing a read-only page. Sign in to edit.</p>
        <Link href="/login" className={buttonClass("secondary", "w-full")}>
          <LogIn className="size-4" aria-hidden /> Sign in
        </Link>
      </div>
    );
  }
  const initials = user.displayName.slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-3 border-t border-line px-4 py-4">
      <Link href="/settings/account" className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover ring-1 ring-line-strong" />
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-raised font-display text-[14px] font-bold text-bone ring-1 ring-line-strong">
            {initials}
          </span>
        )}
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[14px] font-semibold text-bone">{user.displayName}</span>
          <span className="block truncate text-[12.5px] text-fog">{user.roleLabel}</span>
        </span>
      </Link>
      <NoticeBell count={user.notices} />
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="grid size-9 place-items-center text-fog transition-colors hover:bg-white/[0.04] hover:text-bone"
          title="Sign out"
        >
          <LogOut className="size-[18px]" aria-hidden />
          <span className="sr-only">Sign out</span>
        </button>
      </form>
    </div>
  );
}

export function Sidebar({
  settings,
  user,
  locked,
  showcase = false,
}: {
  settings: TeamSettings;
  user: ShellUser;
  locked: SectionKey[];
  showcase?: boolean;
}) {
  return (
    <div className="hidden border-r border-line bg-rail lg:block">
      <aside className="sticky top-0 flex h-dvh flex-col">
        <TeamBlock settings={settings} />
        <div className="flex-1 overflow-y-auto pb-4 pt-1">
          <NavLinks locked={locked} />
        </div>
        <UserBlock user={user} showcase={showcase} />
      </aside>
    </div>
  );
}
