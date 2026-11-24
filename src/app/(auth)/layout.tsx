/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getSettings } from "@/lib/data/settings";
import { TeamMark } from "@/components/shell/team-mark";

// Branding and access come from the database on every request.
export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <div
      className="grid min-h-dvh lg:grid-cols-[minmax(420px,520px)_1fr]"
      style={{ "--accent": s.accent_color, "--accent-2": s.secondary_color } as React.CSSProperties}
    >
      <div className="relative order-2 flex flex-col px-6 py-10 sm:px-12 lg:order-1 lg:py-14">
        <Link href="/" className="flex items-center gap-3">
          <TeamMark name={s.university_name} logoUrl={s.logo_url} />
          <span className="leading-tight">
            <span className="block text-[13px] text-fog">{s.university_name}</span>
            <span className="type-display block text-[17px] font-bold">{s.team_name}</span>
          </span>
        </Link>
        <main className="flex flex-1 flex-col justify-center py-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </main>
        <p className="text-[12px] text-dim">Private team platform. Access by invitation only.</p>
      </div>

      <aside className="relative order-1 h-56 overflow-hidden sm:h-72 lg:order-2 lg:h-auto">
        <img
          src={s.hero_image_url}
          alt={`${s.university_name} campus`}
          className="absolute inset-0 size-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/10 lg:bg-gradient-to-r lg:from-ink lg:via-ink/50 lg:to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_55%,color-mix(in_oklab,var(--accent)_38%,transparent))] mix-blend-screen" />
        <div className="absolute bottom-6 left-6 right-6 lg:bottom-14 lg:left-14">
          <p className="type-display text-[44px] font-extrabold text-bone sm:text-[64px] lg:text-[84px]">
            {s.team_name}
          </p>
        </div>
      </aside>
    </div>
  );
}
