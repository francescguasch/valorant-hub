import clsx from "clsx";
import { GOAL_STATUS_LABEL } from "@/lib/constants";
import { formatDay } from "@/lib/format";
import type { Goal, GoalPoint } from "@/lib/data/players";
import { DemoBadge } from "../ui/panel";

/** Progress over time as a small line: one point per recorded change. */
export function ProgressSparkline({ points, label }: { points: GoalPoint[]; label: string }) {
  if (points.length < 2) return null;
  const w = 160;
  const h = 36;
  const xs = (i: number) => 4 + (i / (points.length - 1)) * (w - 8);
  const ys = (p: number) => h - 4 - (p / 100) * (h - 8);
  const d = points.map((p, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(p.progress).toFixed(1)}`).join(" ");
  const last = points[points.length - 1]!;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}: progress from ${points[0]!.progress}% on ${formatDay(points[0]!.recorded_on)} to ${last.progress}% on ${formatDay(last.recorded_on)}`}>
      <line x1={4} x2={w - 4} y1={h - 4} y2={h - 4} stroke="var(--color-line)" strokeWidth={1} />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xs(points.length - 1)} cy={ys(last.progress)} r={4} fill="var(--accent)" stroke="var(--color-panel)" strokeWidth={2} />
    </svg>
  );
}

export function GoalCard({ goal, history, playerName }: { goal: Goal; history: GoalPoint[]; playerName?: string }) {
  const done = goal.status === "achieved" || goal.status === "missed";
  return (
    <div className={clsx("flex flex-col gap-2 border border-line bg-panel p-4", done && "opacity-75")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {playerName ? <p className="text-[12.5px] text-fog">{playerName}</p> : null}
          <p className="font-semibold text-bone">
            {goal.description} {goal.is_demo ? <DemoBadge className="ml-1 align-middle" /> : null}
          </p>
        </div>
        <span className="num shrink-0 text-[24px] font-semibold text-bone">{goal.progress}%</span>
      </div>
      <span className="relative block h-1.5 bg-line" role="progressbar" aria-valuenow={goal.progress} aria-valuemin={0} aria-valuemax={100} aria-label={goal.description}>
        <span className={clsx("absolute inset-y-0 left-0 rounded-r-[4px]", goal.status === "achieved" ? "bg-win" : "bg-accent")} style={{ width: `${goal.progress}%` }} />
      </span>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
        <div>
          <dt className="text-dim">Now</dt>
          <dd className="text-fog">{goal.current_level ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-dim">Target</dt>
          <dd className="text-fog">{goal.target ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-dim">Deadline</dt>
          <dd className="text-fog">{goal.deadline ? formatDay(goal.deadline) : "—"}</dd>
        </div>
        <div>
          <dt className="text-dim">Status</dt>
          <dd className="text-fog">{GOAL_STATUS_LABEL[goal.status] ?? goal.status}</dd>
        </div>
      </dl>
      {goal.comments ? <p className="text-[13.5px] text-fog">{goal.comments}</p> : null}
      <ProgressSparkline points={history} label={goal.description} />
    </div>
  );
}
