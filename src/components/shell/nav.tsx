"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Binoculars,
  CalendarDays,
  ChartNoAxesCombined,
  Clapperboard,
  LayoutDashboard,
  Lock,
  Map,
  Settings,
  Swords,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SECTIONS, type SectionKey } from "@/lib/sections";

const ICONS: Record<SectionKey, LucideIcon> = {
  overview: LayoutDashboard,
  playbook: Map,
  matches: Swords,
  scouting: Binoculars,
  analytics: ChartNoAxesCombined,
  roster: Users,
  development: TrendingUp,
  vod: Clapperboard,
  practice: CalendarDays,
  settings: Settings,
};

export function NavLinks({ locked, onNavigate }: { locked: SectionKey[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className="flex flex-col gap-0.5 px-3">
      {SECTIONS.map((s) => {
        const Icon = ICONS[s.key];
        const active = s.href === "/" ? pathname === "/" : pathname === s.href || pathname.startsWith(`${s.href}/`);
        const isLocked = locked.includes(s.key);
        return (
          <Link
            key={s.key}
            href={isLocked ? `/login?next=${encodeURIComponent(s.href)}` : s.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "group relative flex h-10 items-center gap-3 px-3 text-[15px] font-medium transition-colors",
              active ? "bg-raised text-bone" : "text-fog hover:bg-white/[0.03] hover:text-bone",
            )}
          >
            <span
              aria-hidden
              className={clsx("absolute inset-y-1.5 left-0 w-[3px] bg-accent transition-opacity", active ? "opacity-100" : "opacity-0")}
            />
            <Icon className={clsx("size-[18px] shrink-0", active ? "text-accent" : "text-dim group-hover:text-fog")} aria-hidden />
            <span className="truncate">{s.label}</span>
            {isLocked ? <Lock className="ml-auto size-3.5 text-dim" aria-label="Sign in to view" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
