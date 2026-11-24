/* eslint-disable @next/next/no-img-element */
import type { TeamSettings } from "@/lib/data/settings";
import type { MatchRow, Record as TeamRecord } from "@/lib/stats/matches";
import { formatPct } from "@/lib/stats/matches";
import { ResultChip } from "../ui/panel";

type Props = {
  settings: TeamSettings;
  record: TeamRecord;
  streak: { result: "W" | "L" | "D"; count: number } | null;
  lastFive: MatchRow[];
};

const STREAK_WORD = { W: "won", L: "lost", D: "drawn" } as const;

export function Hero({ settings, record, streak, lastFive }: Props) {
  const empty = record.played === 0;
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden border-b border-line bg-rail">
      {/* The original campus photograph, untouched; only overlays sit on top. */}
      <img
        src={settings.hero_image_url}
        alt={`${settings.university_name} campus`}
        className="absolute inset-0 -z-20 size-full object-cover object-[60%_40%]"
        fetchPriority="high"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--color-ink)_0%,color-mix(in_oklab,var(--color-ink)_88%,transparent)_34%,color-mix(in_oklab,var(--color-ink)_35%,transparent)_70%,color-mix(in_oklab,var(--color-ink)_15%,transparent)_100%)]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(118deg,transparent_48%,color-mix(in_oklab,var(--accent)_42%,transparent)_100%)] mix-blend-screen" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-gradient-to-t from-ink via-ink/70 to-transparent" />
      <div aria-hidden className="hero-sweep pointer-events-none absolute inset-y-0 left-0 -z-10 w-1/3 bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--accent)_55%,transparent),transparent)] mix-blend-screen" />

      <div className="px-5 pb-6 pt-12 sm:px-8 sm:pt-16 lg:pt-20">
        <div className="hero-rise flex gap-4 sm:gap-5">
          <span aria-hidden className="mt-1 w-1.5 shrink-0 origin-top -skew-x-[14deg] bg-accent shadow-[0_0_24px_var(--accent)] sm:w-2" />
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.22em] text-bone/75 sm:text-[13px]">
              {settings.hero_kicker}
            </p>
            <h1 id="hero-title" className="type-display mt-3 text-[clamp(44px,7.2vw,104px)] font-extrabold text-bone">
              {settings.university_name}
            </h1>
            <p className="type-display mt-1 text-[clamp(30px,4.4vw,62px)] font-extrabold text-accent [text-shadow:0_0_32px_color-mix(in_oklab,var(--accent)_45%,transparent)]">
              {settings.team_name}
            </p>
            <p className="mt-4 text-[12.5px] font-semibold uppercase tracking-[0.22em] text-bone/70 sm:text-[13px]">
              {settings.hero_tagline}
              <span className="mx-3 text-accent">/</span>
              Competitive {settings.season_label}
            </p>
          </div>
        </div>

        {/* Live record, computed from the match database */}
        <dl
          className="hero-rise mt-10 grid grid-cols-3 border-t border-white/10 sm:mt-14 md:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
          style={{ animationDelay: "120ms" }}
        >
          <Stat label="Matches" value={empty ? "0" : String(record.played)} />
          <Stat label="Wins" value={String(record.wins)} />
          <Stat label="Losses" value={String(record.losses)} />
          <Stat
            label="Win rate"
            value={formatPct(record.winRate)}
            note={record.draws ? `${record.draws} draw${record.draws > 1 ? "s" : ""} included` : undefined}
          />
          <Stat
            label="Current streak"
            value={streak ? `${streak.result}${streak.count}` : "—"}
            note={streak ? `${streak.count} ${STREAK_WORD[streak.result]} in a row` : undefined}
          />
          <div className="col-span-3 flex flex-col justify-center gap-2 border-t border-white/10 py-4 md:col-span-1 md:border-l md:border-t-0 md:pl-6">
            <dt className="text-[12.5px] text-fog">Last five</dt>
            <dd className="flex gap-1.5">
              {lastFive.length === 0 ? (
                <span className="text-[14px] text-fog">No matches yet</span>
              ) : (
                lastFive.map((m) => <ResultChip key={m.id} result={m.result} />)
              )}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 border-white/10 py-4 pr-3 md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:pl-6">
      <dt className="text-[12.5px] text-fog">{label}</dt>
      <dd className="num text-[40px] font-semibold leading-none text-bone sm:text-[48px]">{value}</dd>
      {note ? <dd className="text-[12px] text-dim">{note}</dd> : null}
    </div>
  );
}
