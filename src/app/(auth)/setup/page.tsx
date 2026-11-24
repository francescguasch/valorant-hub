import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasOwner } from "../actions";
import { SetupForm } from "../forms";

export const metadata: Metadata = { title: "Set up the team owner" };

export default async function SetupPage() {
  if (await hasOwner()) redirect("/login");
  return (
    <>
      <h1 className="type-display text-[44px] font-extrabold">Set up the team owner</h1>
      <p className="mb-7 mt-2 text-fog">
        This page works only once, before the team has an owner. The owner then invites coaches and players from
        Settings.
      </p>
      <SetupForm />
    </>
  );
}
