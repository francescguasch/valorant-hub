import "server-only";
import type { Tx } from "@/lib/db";
import { loadCatalog } from "@/lib/data/catalog";
import { formatDay } from "@/lib/format";

/** Choices for the VOD review form: players, recent matches and recent practice sessions. */
export async function developmentOptions(tx: Tx, includePlayer?: string) {
  const catalog = await loadCatalog(tx);
  const matches = await tx<{ id: string; played_on: string; map_id: string; opponent_id: string; our_score: number; opp_score: number }[]>`
    select id, played_on, map_id, opponent_id, our_score, opp_score from public.matches order by played_on desc, created_at desc limit 60`;
  const sessions = await tx<{ id: string; day: string; session_type: string }[]>`
    select id, (starts_at at time zone 'UTC')::date::text as day, session_type from public.practice_sessions
    where starts_at <= now() + interval '1 day' order by starts_at desc limit 40`;
  return {
    catalog,
    players: catalog.players.filter((p) => p.active || p.id === includePlayer).map((p) => ({ value: p.id, label: p.nickname })),
    matches: matches.map((m) => ({
      value: m.id,
      label: `${formatDay(m.played_on)} · ${catalog.mapById.get(m.map_id)?.name} vs ${catalog.opponentById.get(m.opponent_id)?.name} (${m.our_score}–${m.opp_score})`,
    })),
    sessions: sessions.map((s) => ({ value: s.id, label: `${formatDay(s.day)} · ${s.session_type}` })),
  };
}

export function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}
