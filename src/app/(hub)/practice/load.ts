import "server-only";
import type { Tx } from "@/lib/db";

export type SessionRow = {
  id: string;
  starts_at: string;
  local_day: string;
  local_time: string;
  duration_min: number;
  session_type: string;
  map_id: string | null;
  strategy_id: string | null;
  objective: string | null;
  attending_player_ids: string[];
  outcome: string | null;
  coach_notes: string | null;
  next_steps: string | null;
  status: "planned" | "completed" | "cancelled";
  is_demo: boolean;
};

export function sessionSelect(tz: string) {
  // tz comes from team settings (validated against the IANA list when saved)
  // IANA names only use these characters; anything else is dropped.
  const z = tz.replace(/[^A-Za-z0-9/_+-]/g, "");
  return `select id, starts_at::text as starts_at,
    to_char(starts_at at time zone '${z}', 'YYYY-MM-DD') as local_day,
    to_char(starts_at at time zone '${z}', 'HH24:MI') as local_time,
    duration_min, session_type, map_id, strategy_id, objective, attending_player_ids, outcome, coach_notes, next_steps, status, is_demo
    from public.practice_sessions`;
}

export async function sessionsBetween(tx: Tx, tz: string, fromDay: string, toDay: string): Promise<SessionRow[]> {
  return tx.unsafe<SessionRow[]>(
    `${sessionSelect(tz)} where starts_at >= ($1::date::timestamp at time zone $3) and starts_at < ($2::date::timestamp at time zone $3) order by starts_at`,
    [fromDay, toDay, tz],
  );
}

export function todayIn(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function tzAbbrev(tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? tz;
}
