import Link from "next/link";
import clsx from "clsx";
import { FEEDBACK_STATUS_LABEL } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import type { Feedback } from "@/lib/data/players";
import { DemoBadge } from "../ui/panel";

export function FeedbackCard({ f, playerName, href }: { f: Feedback; playerName?: string; href?: string }) {
  const rows: [string, string | null][] = [
    ["Strengths", f.strengths],
    ["Areas to improve", f.areas_to_improve],
    ["Specific example", f.specific_example],
    ["Evidence", f.evidence],
    ["Improvement action", f.improvement_action],
  ];
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-fog">
        {playerName ? <span className="font-semibold text-bone">{playerName}</span> : null}
        <span>{f.category}</span>
        <span>· {formatDay(f.given_on, { month: "short", day: "numeric", year: "numeric" })}</span>
        <span
          className={clsx(
            "ml-auto border px-1.5 text-[11.5px] font-semibold",
            f.status === "resolved" ? "border-win/50 text-win" : f.status === "in_progress" ? "border-demo/50 text-demo" : "border-line-strong text-fog",
          )}
        >
          {FEEDBACK_STATUS_LABEL[f.status]}
        </span>
        {f.is_demo ? <DemoBadge /> : null}
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="text-[12.5px] text-dim">{k}</dt>
              <dd className="whitespace-pre-wrap text-[14px] text-bone">{v}</dd>
            </div>
          ))}
      </dl>
      {f.follow_up_on || f.vod_clip_url ? (
        <p className="mt-3 text-[13px] text-fog">
          {f.follow_up_on ? `Follow-up ${formatDay(f.follow_up_on)}` : ""}
          {f.follow_up_on && f.vod_clip_url ? " · " : ""}
          {f.vod_clip_url ? "Has VOD clip" : ""}
        </p>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} className="block border border-line bg-panel p-4 transition-colors hover:border-line-strong">
      {body}
    </Link>
  ) : (
    <div className="border border-line bg-panel p-4">{body}</div>
  );
}
