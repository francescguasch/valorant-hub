import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { actorOf, getViewer, isStaff } from "@/lib/auth/viewer";
import { getSettings } from "@/lib/data/settings";
import { withActor } from "@/lib/db";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { MatchForm } from "../match-form";
import { loadMatchForm } from "../load";

export const metadata: Metadata = { title: "Add new match" };

export default async function NewMatchPage() {
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect(viewer.kind === "member" ? "/matches" : "/login?next=%2Fmatches%2Fnew");
  const settings = await getSettings();
  const data = await withActor(actorOf(viewer), (tx) => loadMatchForm(tx, settings.timezone));
  return (
    <>
      <PageHeader title="Add new match" description="One map at a time. For a BO3 or BO5, save each map with the same series id." />
      <PageBody>
        <MatchForm {...data} />
      </PageBody>
    </>
  );
}
