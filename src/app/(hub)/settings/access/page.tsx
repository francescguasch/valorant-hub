import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer, isOwner } from "@/lib/auth/viewer";
import { getSettings } from "@/lib/data/settings";
import { SECTIONS } from "@/lib/sections";
import { AccessForm } from "./access-form";

export const metadata: Metadata = { title: "Visitor access" };

const RISK: Record<string, string> = {
  playbook: "Rivals with the link could read your strategies.",
  scouting: "Shows your notes on opponents.",
  vod: "Shows reviewed mistakes by player.",
};

export default async function AccessPage() {
  const viewer = await getViewer();
  if (!isOwner(viewer)) redirect("/settings/account");
  const settings = await getSettings();
  const sections = SECTIONS.filter((s) => s.publicable).map((s) => ({
    key: s.key,
    label: s.label,
    blurb: s.blurb,
    risk: RISK[s.key] ?? null,
  }));
  return (
    <AccessForm
      enabled={settings.public_view_enabled}
      selected={settings.public_sections}
      realNames={settings.show_real_names}
      sections={sections}
    />
  );
}
