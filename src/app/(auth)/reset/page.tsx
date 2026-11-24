import type { Metadata } from "next";
import { ResetForm } from "../forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ResetPage() {
  return (
    <>
      <h1 className="type-display text-[44px] font-extrabold">Reset your password</h1>
      <p className="mb-7 mt-2 text-fog">
        Ask the team owner or a coach for a reset code. They create it in Settings → Members. Then choose a new
        password here.
      </p>
      <ResetForm />
    </>
  );
}
