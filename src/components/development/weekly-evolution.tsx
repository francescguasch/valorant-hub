import type { Feedback, GoalPoint } from "@/lib/data/players";
import { formatDay } from "@/lib/format";

const WEEKS = 8;

function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The last eight weeks for one player: feedback received, feedback resolved,
 * and average goal progress at the end of each week.
 */
export function WeeklyEvolution({ feedback, history, today = new Date().toISOString().slice(0, 10) }: { feedback: Feedback[]; history: GoalPoint[]; today?: string }) {
  const thisWeek = mondayOf(today);
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(thisWeek, (i - (WEEKS - 1)) * 7));
  const goalIds = [...new Set(history.map((h) => h.goal_id))];

  const rows = weeks.map((start) => {
    const end = addDays(start, 6);
    const given = feedback.filter((f) => f.given_on >= start && f.given_on <= end);
    const categories = [...new Set(given.map((f) => f.category))];
    const progress = goalIds
      .map((g) => history.filter((h) => h.goal_id === g && h.recorded_on <= end).at(-1)?.progress)
      .filter((p): p is number => p !== undefined);
    return {
      start,
      given: given.length,
      resolved: given.filter((f) => f.status === "resolved").length,
      categories,
      avg: progress.length ? Math.round(progress.reduce((a, b) => a + b, 0) / progress.length) : null,
    };
  });

  if (rows.every((r) => r.given === 0 && r.avg === null)) return null;

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-[13px] font-semibold text-fog">Last 8 weeks</p>
      <table className="w-full min-w-[640px] text-left text-[13.5px]">
        <thead className="text-[12px] text-dim">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Week of</th>
            {rows.map((r) => (
              <th key={r.start} className="px-2 py-1.5 font-medium">
                {formatDay(r.start)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="num text-[16px] text-bone">
          <tr className="border-t border-line">
            <td className="py-1.5 pr-3 font-sans text-[13px] text-fog">Feedback received</td>
            {rows.map((r) => (
              <td key={r.start} className="px-2 py-1.5" title={r.categories.join(", ")}>
                {r.given || "·"}
              </td>
            ))}
          </tr>
          <tr className="border-t border-line">
            <td className="py-1.5 pr-3 font-sans text-[13px] text-fog">Of those, resolved</td>
            {rows.map((r) => (
              <td key={r.start} className="px-2 py-1.5">
                {r.given ? r.resolved : "·"}
              </td>
            ))}
          </tr>
          <tr className="border-t border-line">
            <td className="py-1.5 pr-3 font-sans text-[13px] text-fog">Average goal progress</td>
            {rows.map((r) => (
              <td key={r.start} className="px-2 py-1.5">
                {r.avg === null ? "·" : `${r.avg}%`}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
