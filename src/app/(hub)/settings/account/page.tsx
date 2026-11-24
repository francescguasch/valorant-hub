import type { Metadata } from "next";
import { requireMember, ROLE_LABEL } from "@/lib/auth/viewer";
import { Panel } from "@/components/ui/panel";
import { PasswordForm, ProfileForm } from "./account-forms";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const me = await requireMember("/settings/account");
  return (
    <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
      <Panel title="Profile" description={`${me.email} · ${ROLE_LABEL[me.role]}`}>
        <ProfileForm displayName={me.displayName} />
      </Panel>
      <Panel title="Password">
        <PasswordForm />
      </Panel>
    </div>
  );
}
