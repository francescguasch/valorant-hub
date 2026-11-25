import { describe, expect, it } from "vitest";
import { byType, defaultSlots, perf, perfBy, slotGames, tier, type PlayerGame } from "./player";

const game = (over: Partial<PlayerGame>): PlayerGame => ({
  match_id: Math.random().toString(36),
  played_on: "2026-11-01",
  match_type: "scrim",
  map_id: "split",
  opponent_id: "o",
  result: "W",
  our_score: 13,
  opp_score: 7,
  agent_id: "yoru",
  kills: 20,
  deaths: 15,
  assists: 4,
  acs: 260,
  adr: 160,
  hs_pct: 25,
  first_kills: 3,
  first_deaths: 2,
  ...over,
});

describe("player performance", () => {
  const games = [
    game({ agent_id: "yoru", map_id: "split" }),
    game({ agent_id: "yoru", map_id: "split", result: "L", our_score: 9, opp_score: 13, kills: 14, deaths: 18, acs: 190 }),
    game({ agent_id: "raze", map_id: "split", match_type: "official", kills: 18, deaths: 16, acs: 240 }),
    game({ agent_id: "raze", map_id: "bind", match_type: "tournament", kills: null, deaths: null, acs: null, adr: null }),
  ];

  it("adds up win rate, K/D, KPR and averages", () => {
    const p = perf(games.slice(0, 2));
    expect(p.games).toBe(2);
    expect(p.winRate).toBe(0.5);
    expect(p.kd).toBeCloseTo(34 / 33);
    expect(p.kpr).toBeCloseTo(34 / 42); // 20 + 22 rounds
    expect(p.acs).toBe(225);
  });

  it("ignores games without a scoreboard for per-round numbers", () => {
    const p = perf(games.slice(2));
    expect(p.games).toBe(2);
    expect(p.kpr).toBeCloseTo(18 / 20);
    expect(p.acs).toBe(240);
  });

  it("splits practice and officials", () => {
    expect(byType(games, "practice")).toHaveLength(2);
    expect(byType(games, "officials")).toHaveLength(2);
    expect(byType(games, "all")).toHaveLength(4);
  });

  it("groups by agent and map, most played first", () => {
    // Same number of games: the better ACS comes first.
    expect(perfBy(games, "agent_id").map((g) => [g.id, g.perf.games])).toEqual([
      ["raze", 2],
      ["yoru", 2],
    ]);
    expect(perfBy(games, "map_id")[0]).toMatchObject({ id: "split" });
    expect(slotGames(games, "split", "raze")).toHaveLength(1);
    expect(slotGames(games, null, null)).toHaveLength(4);
  });

  it("picks the two most played agents to compare by default", () => {
    expect(defaultSlots([...games, game({})])).toEqual({ a: { map: null, agent: "yoru" }, b: { map: null, agent: "raze" } });
    expect(defaultSlots(games.slice(0, 2)).a).toEqual({ map: "split", agent: "yoru" });
    expect(defaultSlots([]).a).toEqual({ map: null, agent: null });
  });

  it("reads numbers into tiers", () => {
    expect(tier("acs", 268)).toBe("good");
    expect(tier("kd", 1.0)).toBe("ok");
    expect(tier("winRate", 0.4)).toBe("low");
    expect(tier("kpr", null)).toBeNull();
  });
});
