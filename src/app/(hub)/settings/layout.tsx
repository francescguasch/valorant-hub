import { requireMember } from "@/lib/auth/viewer";
import { PageHeader } from "@/components/shell/page-header";
import { SettingsTabs } from "./tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember("/settings");
  const tabs = [
    ...(me.role !== "player"
      ? [
          { href: "/settings", label: "Team & branding" },
          { href: "/settings/members", label: "Members" },
        ]
      : []),
    ...(me.role === "owner"
      ? [
          { href: "/settings/access", label: "Visitor access" },
          { href: "/settings/data", label: "Data" },
        ]
      : []),
    { href: "/settings/account", label: "Your account" },
  ];
  return (
    <>
      <PageHeader
        title="Settings"
        description={
          me.role === "player"
            ? "Your name and password."
            : "Team identity, members and access. Maps, agents, roster and opponents become editable here in phases 2 and 3."
        }
      />
      <SettingsTabs tabs={tabs} />
      <div className="px-5 py-6 sm:px-8 sm:py-8">{children}</div>
    </>
  );
}
