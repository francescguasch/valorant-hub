import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer, isStaff } from "@/lib/auth/viewer";
import { getSettings } from "@/lib/data/settings";
import { BrandingForm } from "./branding-form";
import { currentPreset } from "@/lib/presets";

export const metadata: Metadata = { title: "Settings" };

const COMMON = ["America/Chicago", "America/Denver", "America/New_York", "America/Los_Angeles", "Pacific/Honolulu", "Europe/Madrid"];

export default async function BrandingPage() {
  const viewer = await getViewer();
  if (!isStaff(viewer)) redirect("/settings/account");
  const settings = await getSettings();
  const all = Intl.supportedValuesOf("timeZone");
  const timezones = [...COMMON, ...all.filter((tz) => !COMMON.includes(tz))];
  return <BrandingForm settings={settings} timezones={timezones} defaultHero={currentPreset().heroImage} />;
}
