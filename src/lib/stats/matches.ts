/**
 * Match statistics. Pure functions over the rows stored in `public.matches`,
 * so every number on screen is derived from real records and nothing else.
 * Scores, round difference and the W/L/D result are computed by the database;
 * this module aggregates them.
 */

export type Result = "W" | "L" | "D";
export type MatchType = "scrim" | "official" | "tournament";

export type MatchRow = {
  id: string;
  played_on: string; // YYYY-MM-DD
  created_at: string;
  season: string;
  competition: string | null;
  match_type: MatchType;
  opponent_id: string;
  series_id: string | null;
  series_format: "BO1" | "BO3" | "BO5" | null;
  map_number: number | null;
  map_id: string;
  our_agent_ids: string[];
  opp_agent_ids: string[];
  our_comp_key: string;
  opp_comp_key: string;
  our_t_rounds: number;
  our_ct_rounds: number;
  opp_t_rounds: number;
  opp_ct_rounds: number;
  our_ot_rounds: number;
  opp_ot_rounds: number;
  our_score: number;
  opp_score: number;
  round_diff: number;
  result: Result;
  is_demo: boolean;
  pistols_won?: number | null;
  anti_eco_won?: number | null;
  anti_eco_played?: number | null;
  bonus_won?: number | null;
  bonus_played?: number | null;
  first_bloods?: number | null;
  first_blood_wins?: number | null;
};

/** Below this many maps a percentage is shown with a small-sample warning. */
export const MIN_SAMPLE = 3;

export type Record = {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  /** 0–1, or null when nothing has been played. */
  winRate: number | null;
  roundsWon: number;
  roundsLost: number;
  roundDiff: number;
  smallSample: boolean;
};

export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

export function recentFirst(matches: MatchRow[]): MatchRow[] {
  return [...matches].sort(
    (a, b) =>
      b.played_on.localeCompare(a.played_on) ||
      (b.map_number ?? 0) - (a.map_number ?? 0) ||
      b.created_at.localeCompare(a.created_at),
  );
}

export function record(matches: MatchRow[]): Record {
  let wins = 0, losses = 0, draws = 0, roundsWon = 0, roundsLost = 0;
  for (const m of matches) {
    if (m.result === "W") wins++;
    else if (m.result === "L") losses++;
    else draws++;
    roundsWon += m.our_score;
    roundsLost += m.opp_score;
  }
  const played = matches.length;
  return {
    played,
    wins,
    losses,
    draws,
    winRate: ratio(wins, played),
    roundsWon,
    roundsLost,
    roundDiff: roundsWon - roundsLost,
    smallSample: played < MIN_SAMPLE,
  };
}

/** Consecutive identical results starting from the most recent map. */
export function currentStreak(matches: MatchRow[]): { result: Result; count: number } | null {
  const ordered = recentFirst(matches);
  if (ordered.length === 0) return null;
  const first = ordered[0]!.result;
  let count = 0;
  for (const m of ordered) {
    if (m.result !== first) break;
    count++;
  }
  return { result: first, count };
}

export function lastResults(matches: MatchRow[], n = 5): MatchRow[] {
  return recentFirst(matches).slice(0, n);
}

export type SideStats = { won: number; played: number; rate: number | null };

/**
 * Rounds won on each side. In the half where we attack (T), the rounds played
 * are our T rounds plus their CT rounds, and the other way round for CT.
 */
export function sideStats(matches: MatchRow[]): { t: SideStats; ct: SideStats } {
  let tWon = 0, tPlayed = 0, ctWon = 0, ctPlayed = 0;
  for (const m of matches) {
    tWon += m.our_t_rounds;
    tPlayed += m.our_t_rounds + m.opp_ct_rounds;
    ctWon += m.our_ct_rounds;
    ctPlayed += m.our_ct_rounds + m.opp_t_rounds;
  }
  return {
    t: { won: tWon, played: tPlayed, rate: ratio(tWon, tPlayed) },
    ct: { won: ctWon, played: ctPlayed, rate: ratio(ctWon, ctPlayed) },
  };
}

export type MapStat = Record & { mapId: string; sides: ReturnType<typeof sideStats> };

export function mapStats(matches: MatchRow[]): MapStat[] {
  const groups = new Map<string, MatchRow[]>();
  for (const m of matches) groups.set(m.map_id, [...(groups.get(m.map_id) ?? []), m]);
  return [...groups.entries()]
    .map(([mapId, rows]) => ({ mapId, ...record(rows), sides: sideStats(rows) }))
    .sort((a, b) => b.played - a.played);
}

function byStrength(a: Record, b: Record) {
  return (b.winRate ?? 0) - (a.winRate ?? 0) || b.roundDiff - a.roundDiff || b.played - a.played;
}

/** Strongest and weakest maps, only among maps with enough games to judge. */
export function strongestAndWeakest(stats: MapStat[], count = 2) {
  const eligible = stats.filter((s) => s.played >= MIN_SAMPLE).sort(byStrength);
  const strongest = eligible.slice(0, count);
  const weakest = [...eligible].reverse().filter((s) => !strongest.includes(s)).slice(0, count);
  return { strongest, weakest, eligibleCount: eligible.length };
}

export type CompStat = Record & { key: string; agentIds: string[]; mapIds: string[] };

/** Group by canonical composition (agent order never matters). */
export function compStats(matches: MatchRow[], side: "ours" | "theirs" = "ours"): CompStat[] {
  const groups = new Map<string, MatchRow[]>();
  for (const m of matches) {
    const key = side === "ours" ? m.our_comp_key : m.opp_comp_key;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups.entries()]
    .map(([key, rows]) => ({
      key,
      agentIds: key.split("."),
      mapIds: [...new Set(rows.map((r) => r.map_id))],
      ...record(rows),
    }))
    .sort((a, b) => b.played - a.played || byStrength(a, b));
}

export type AgentUsage = { agentId: string; picks: number; pickRate: number; wins: number; winRate: number | null };

export function agentUsage(matches: MatchRow[]): AgentUsage[] {
  const picks = new Map<string, { picks: number; wins: number }>();
  for (const m of matches) {
    for (const id of new Set(m.our_agent_ids)) {
      const cur = picks.get(id) ?? { picks: 0, wins: 0 };
      cur.picks++;
      if (m.result === "W") cur.wins++;
      picks.set(id, cur);
    }
  }
  return [...picks.entries()]
    .map(([agentId, v]) => ({
      agentId,
      picks: v.picks,
      pickRate: v.picks / matches.length,
      wins: v.wins,
      winRate: ratio(v.wins, v.picks),
    }))
    .sort((a, b) => b.picks - a.picks);
}

export type SeriesResult = {
  seriesId: string;
  format: MatchRow["series_format"];
  opponentId: string;
  playedOn: string;
  mapsWon: number;
  mapsLost: number;
  maps: MatchRow[];
  result: Result;
};

/** Rebuild BO1/BO3/BO5 results from the individual maps that share a series id. */
export function seriesResults(matches: MatchRow[]): SeriesResult[] {
  const groups = new Map<string, MatchRow[]>();
  for (const m of matches) if (m.series_id) groups.set(m.series_id, [...(groups.get(m.series_id) ?? []), m]);
  return [...groups.entries()]
    .map(([seriesId, rows]) => {
      const maps = [...rows].sort((a, b) => (a.map_number ?? 0) - (b.map_number ?? 0));
      const mapsWon = maps.filter((m) => m.result === "W").length;
      const mapsLost = maps.filter((m) => m.result === "L").length;
      return {
        seriesId,
        format: maps[0]!.series_format,
        opponentId: maps[0]!.opponent_id,
        playedOn: maps[0]!.played_on,
        mapsWon,
        mapsLost,
        maps,
        result: (mapsWon > mapsLost ? "W" : mapsWon < mapsLost ? "L" : "D") as Result,
      };
    })
    .sort((a, b) => b.playedOn.localeCompare(a.playedOn));
}

export function formatPct(value: number | null, digits = 0): string {
  return value === null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

export function formatDiff(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

export type Matchup = Record & { key: string; ourKey: string; oppKey: string };

/** Our composition against their composition, both canonical. */
export function matchupStats(matches: MatchRow[]): Matchup[] {
  const groups = new Map<string, MatchRow[]>();
  for (const m of matches) {
    const key = `${m.our_comp_key}|${m.opp_comp_key}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups.entries()]
    .map(([key, rows]) => ({ key, ourKey: rows[0]!.our_comp_key, oppKey: rows[0]!.opp_comp_key, ...record(rows) }))
    .sort((a, b) => b.played - a.played || (b.winRate ?? 0) - (a.winRate ?? 0));
}

/** Best maps for one composition: highest win rate, then most played. */
export function bestMaps(matches: MatchRow[], compKey: string, limit = 2): { mapId: string; wins: number; played: number }[] {
  return mapStats(matches.filter((m) => m.our_comp_key === compKey))
    .filter((s) => s.wins > 0)
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0) || b.played - a.played)
    .slice(0, limit)
    .map((s) => ({ mapId: s.mapId, wins: s.wins, played: s.played }));
}

export type RateMetric = { won: number; total: number; rate: number | null; matches: number };

/**
 * Optional round-type metrics. Each one only uses matches where it was recorded,
 * so missing data never counts as a loss.
 */
export function roundTypeMetrics(matches: MatchRow[]) {
  const metric = (rows: MatchRow[], won: (m: MatchRow) => number, total: (m: MatchRow) => number): RateMetric => {
    const w = rows.reduce((s, m) => s + won(m), 0);
    const t = rows.reduce((s, m) => s + total(m), 0);
    return { won: w, total: t, rate: ratio(w, t), matches: rows.length };
  };
  const has = (v: number | null | undefined): v is number => v !== null && v !== undefined;
  return {
    pistol: metric(matches.filter((m) => has(m.pistols_won)), (m) => m.pistols_won!, () => 2),
    antiEco: metric(matches.filter((m) => has(m.anti_eco_played) && m.anti_eco_played! > 0), (m) => m.anti_eco_won ?? 0, (m) => m.anti_eco_played!),
    bonus: metric(matches.filter((m) => has(m.bonus_played) && m.bonus_played! > 0), (m) => m.bonus_won ?? 0, (m) => m.bonus_played!),
    firstBlood: metric(matches.filter((m) => has(m.first_bloods) && m.first_bloods! > 0), (m) => m.first_blood_wins ?? 0, (m) => m.first_bloods!),
  };
}
