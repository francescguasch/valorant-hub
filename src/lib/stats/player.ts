/**
 * Per-player performance from match scoreboards. Pure functions, so the
 * roster page and the tests share one definition of every number.
 */
export type MatchType = "scrim" | "official" | "tournament";

export type PlayerGame = {
  match_id: string;
  played_on: string;
  match_type: MatchType;
  map_id: string;
  opponent_id: string;
  result: "W" | "L" | "D";
  our_score: number;
  opp_score: number;
  agent_id: string | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  acs: number | null;
  adr: number | null;
  hs_pct: number | null;
  first_kills: number | null;
  first_deaths: number | null;
};

export type Perf = {
  games: number;
  wins: number;
  losses: number;
  /** 0–1, null without games. */
  winRate: number | null;
  acs: number | null;
  kd: number | null;
  /** Kills per round, over the games with kills recorded. */
  kpr: number | null;
  adr: number | null;
  hs: number | null;
  kills: number;
  deaths: number;
  assists: number;
  firstKills: number;
  firstDeaths: number;
};

export type TypeFilter = "all" | "practice" | "officials";

export const TYPE_FILTER_LABEL: Record<TypeFilter, string> = {
  all: "All",
  practice: "Practice (scrims)",
  officials: "Officials",
};

export function byType(games: PlayerGame[], type: TypeFilter): PlayerGame[] {
  if (type === "practice") return games.filter((g) => g.match_type === "scrim");
  if (type === "officials") return games.filter((g) => g.match_type !== "scrim");
  return games;
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null && Number.isFinite(Number(x))).map(Number);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export function perf(games: PlayerGame[]): Perf {
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  let fk = 0;
  let fd = 0;
  let killRounds = 0;
  let withKd = false;
  for (const g of games) {
    if (g.kills !== null) {
      kills += g.kills;
      killRounds += g.our_score + g.opp_score;
    }
    if (g.deaths !== null) {
      deaths += g.deaths;
      withKd = true;
    }
    assists += g.assists ?? 0;
    fk += g.first_kills ?? 0;
    fd += g.first_deaths ?? 0;
  }
  const wins = games.filter((g) => g.result === "W").length;
  const losses = games.filter((g) => g.result === "L").length;
  return {
    games: games.length,
    wins,
    losses,
    winRate: games.length ? wins / games.length : null,
    acs: avg(games.map((g) => g.acs)),
    kd: withKd && deaths > 0 ? kills / deaths : withKd && kills > 0 ? kills : null,
    kpr: killRounds > 0 ? kills / killRounds : null,
    adr: avg(games.map((g) => g.adr)),
    hs: avg(games.map((g) => g.hs_pct)),
    kills,
    deaths,
    assists,
    firstKills: fk,
    firstDeaths: fd,
  };
}

/** Performance grouped by agent or map, most played first. */
export function perfBy(games: PlayerGame[], key: "agent_id" | "map_id"): { id: string; perf: Perf }[] {
  const groups = new Map<string, PlayerGame[]>();
  for (const g of games) {
    const id = g[key];
    if (!id) continue;
    groups.set(id, [...(groups.get(id) ?? []), g]);
  }
  return [...groups.entries()]
    .map(([id, gs]) => ({ id, perf: perf(gs) }))
    .sort((a, b) => b.perf.games - a.perf.games || (b.perf.acs ?? 0) - (a.perf.acs ?? 0));
}

/** One slot of the head-to-head: a map (or all) and an agent (or all). */
export function slotGames(games: PlayerGame[], map: string | null, agent: string | null): PlayerGame[] {
  return games.filter((g) => (!map || g.map_id === map) && (!agent || g.agent_id === agent));
}

/**
 * What to compare when nothing is picked yet: the two most played agents;
 * with only one agent, that agent on its most played map vs everywhere.
 */
export function defaultSlots(games: PlayerGame[]): { a: { map: string | null; agent: string | null }; b: { map: string | null; agent: string | null } } {
  const agents = perfBy(games, "agent_id");
  if (agents.length >= 2) return { a: { map: null, agent: agents[0]!.id }, b: { map: null, agent: agents[1]!.id } };
  if (agents.length === 1) {
    const maps = perfBy(slotGames(games, null, agents[0]!.id), "map_id");
    return { a: { map: maps[0]?.id ?? null, agent: agents[0]!.id }, b: { map: null, agent: agents[0]!.id } };
  }
  return { a: { map: null, agent: null }, b: { map: null, agent: null } };
}

/** Fixed scales for the radar, so a shape means the same thing for every player. */
export const RADAR_AXES = [
  { key: "acs", label: "ACS", max: 350, format: (v: number) => String(Math.round(v)) },
  { key: "kd", label: "K/D ratio", max: 2, format: (v: number) => v.toFixed(2) },
  { key: "kpr", label: "Kills per round", max: 1.2, format: (v: number) => v.toFixed(2) },
  { key: "winRate", label: "Win rate", max: 1, format: (v: number) => `${Math.round(v * 100)}%` },
] as const;
export type RadarKey = (typeof RADAR_AXES)[number]["key"];

/** Rough reading of a number against university-level play; used as a secondary colour cue beside the value. */
export function tier(key: RadarKey, v: number | null): "good" | "ok" | "low" | null {
  if (v === null) return null;
  const [good, ok] = { acs: [230, 190], kd: [1.1, 0.9], kpr: [0.8, 0.65], winRate: [0.55, 0.45] }[key];
  return v >= good ? "good" : v >= ok ? "ok" : "low";
}

export const fmt = {
  int: (v: number | null) => (v === null ? "—" : String(Math.round(v))),
  ratio: (v: number | null) => (v === null ? "—" : v.toFixed(2)),
  pct: (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`),
  hs: (v: number | null) => (v === null ? "—" : `${Math.round(v)}%`),
};
