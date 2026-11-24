import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { JoinForm } from "../forms";

export const metadata: Metadata = { title: "Create your account" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const viewer = await getViewer();
  if (viewer.kind === "member") redirect("/");
  return (
    <>
      <h1 className="type-display text-[44px] font-extrabold">Create your account</h1>
      <p className="mb-7 mt-2 text-fog">Enter the invitation code you received from the team owner or a coach.</p>
      <JoinForm code={code ?? ""} />
    </>
  );
}
