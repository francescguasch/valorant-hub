"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function SettingsTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="overflow-x-auto border-b border-line px-5 sm:px-8">
      <ul className="flex gap-6">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative block whitespace-nowrap py-3.5 text-[14.5px] font-medium transition-colors",
                  active ? "text-bone" : "text-fog hover:text-bone",
                )}
              >
                {t.label}
                <span aria-hidden className={clsx("absolute inset-x-0 -bottom-px h-[2px] bg-accent", active ? "opacity-100" : "opacity-0")} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
