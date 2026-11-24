import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer, isStaff } from "@/lib/auth/viewer";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { ObjectiveForm } from "../../forms";

export const metadata: Metadata = { title: "Add objective" };

export default async function NewObjectivePage() {
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/development?tab=objectives");
  return (
    <>
      <PageHeader title="Add team objective" description="Objectives and staff priorities show on the Overview for the whole team." />
      <PageBody>
        <ObjectiveForm initial={{ title: "", details: "", kind: "objective", progress: 0, status: "active", due_on: "" }} />
      </PageBody>
    </>
  );
}
