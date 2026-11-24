import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer, safeNext } from "@/lib/auth/viewer";
import { getSettings } from "@/lib/data/settings";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const [viewer, settings] = await Promise.all([getViewer(), getSettings()]);
  if (viewer.kind === "member") redirect(next);

  const notice = params.reset
    ? "Password updated. Sign in with your new password."
    : params.signedout
      ? "You've signed out."
      : viewer.reason === "no-access"
        ? "This account doesn't have access to the team hub. Ask the team owner."
        : null;

  return (
    <>
      <h1 className="type-display text-[44px] font-extrabold">Sign in</h1>
      <p className="mb-7 mt-2 text-fog">Use the email and password of your team account.</p>
      <LoginForm next={next} notice={notice} />
      {settings.public_view_enabled ? (
        <p className="mt-8 border-t border-line pt-5 text-[14px] text-fog">
          No account?{" "}
          <Link href="/" className="text-bone underline-offset-4 hover:underline">
            View the team page in read-only mode
          </Link>
        </p>
      ) : null}
    </>
  );
}
