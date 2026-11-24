/* eslint-disable @next/next/no-img-element */
import clsx from "clsx";
import { teamInitials } from "@/lib/data/team-initials";

/** Uploaded logo, or the team initials until a logo is added in Settings. */
export function TeamMark({ name, logoUrl, className }: { name: string; logoUrl: string | null; className?: string }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" className={clsx("size-10 shrink-0 object-contain", className)} />;
  }
  return (
    <span
      aria-hidden
      className={clsx(
        "cut-corner grid size-10 shrink-0 place-items-center bg-accent font-display text-[15px] font-extrabold tracking-[0.04em] text-white",
        className,
      )}
    >
      {teamInitials(name)}
    </span>
  );
}
