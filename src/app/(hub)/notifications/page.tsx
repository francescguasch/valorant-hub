import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { requireMember } from "@/lib/auth/viewer";
import { getNotifications } from "@/lib/data/notifications";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const me = await requireMember("/notifications");
  const items = await getNotifications(me);
  return (
    <>
      <PageHeader
        title="Notifications"
        description="What needs your attention now. Items disappear on their own once they're dealt with."
      />
      <PageBody>
        {items.length === 0 ? (
          <EmptyState title="You're all caught up" />
        ) : (
          <ul className="flex max-w-3xl flex-col gap-2">
            {items.map((n) => (
              <li key={n.key}>
                <Link
                  href={n.href}
                  className="flex gap-3 border border-line bg-panel p-4 transition-colors hover:border-line-strong"
                >
                  <span
                    aria-hidden
                    className={clsx(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.tone === "due" ? "bg-accent" : "bg-accent-2/70",
                    )}
                  />
                  <span>
                    <span className="block font-semibold text-bone">{n.title}</span>
                    <span className="block text-[14px] text-fog">{n.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}
