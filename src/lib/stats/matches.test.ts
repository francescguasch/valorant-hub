import { describe, expect, it } from "vitest";
import {
  agentUsage,
  bestMaps,
  matchupStats,
  roundTypeMetrics,
  compStats,
  currentStreak,
  formatDiff,
  formatPct,
  mapStats,
  record,
  seriesResults,
  sideStats,
  strongestAndWeakest,
  type MatchRow,
} from "./matches";

let seq = 0;
function match(p: Partial<MatchRow> & { our: [number, number, number?]; opp: [number, number, number?] }): MatchRow {
  const [ot, oct, oot = 0] = p.our;
  const [tt, tct, tot = 0] = p.opp;
  const ourScore = ot + oct + oot;
  const oppScore = tt + tct + tot;
  seq++;
  return {
    id: `m${seq}`,
    played_on: p.played_on ?? `2026-10-${String(seq).padStart(2, "0")}`,
    created_at: `2026-10-01T00:00:${String(seq).padStart(2, "0")}Z`,
    season: "2026/2027",
    competition: null,
    match_type: p.match_type ?? "scrim",
    opponent_id: p.opponent_id ?? "opp1",
    series_id: p.series_id ?? null,
    series_format: p.series_format ?? null,
    map_number: p.map_number ?? null,
    map_id: p.map_id ?? "ascent",
    our_agent_ids: p.our_agent_ids ?? ["jett", "sova", "killjoy", "omen", "kayo"],
    opp_agent_ids: p.opp_agent_ids ?? ["raze", "fade", "cypher", "astra", "breach"],
    our_comp_key: p.our_comp_key ?? [...(p.our_agent_ids ?? ["jett", "sova", "killjoy", "omen", "kayo"])].sort().join("."),
    opp_comp_key: p.opp_comp_key ?? "astra.breach.cypher.fade.raze",
    our_t_rounds: ot,
    our_ct_rounds: oct,
    opp_t_rounds: tt,
    opp_ct_rounds: tct,
    our_ot_rounds: oot,
    opp_ot_rounds: tot,
    our_score: ourScore,
    opp_score: oppScore,
    round_diff: ourScore - oppScore,
    result: ourScore > oppScore ? "W" : ourScore < oppScore ? "L" : "D",
    is_demo: false,
  };
}

describe("record", () => {
  it("is empty-safe", () => {
    const r = record([]);
    expect(r).toMatchObject({ played: 0, wins: 0, winRate: null, roundDiff: 0, smallSample: true });
  });

  it("counts wins, losses, draws and rounds including overtime", () => {
    const r = record([
      match({ our: [7, 6], opp: [4, 5] }), // 13-9 W
      match({ our: [4, 6], opp: [5, 8] }), // 10-13 L
      match({ our: [6, 6], opp: [6, 6] }), // 12-12 D (24-round scrim)
      match({ match_type: "official", our: [5, 7, 2], opp: [5, 7, 0] }), // 14-12 W in OT
    ]);
    expect(r).toMatchObject({ played: 4, wins: 2, losses: 1, draws: 1, roundsWon: 49, roundsLost: 46, roundDiff: 3 });
    expect(r.winRate).toBe(0.5);
    expect(r.smallSample).toBe(false);
  });
});

describe("currentStreak", () => {
  it("returns null without matches", () => expect(currentStreak([])).toBeNull());
  it("counts from the most recent map backwards", () => {
    const rows = [
      match({ played_on: "2026-10-01", our: [7, 6], opp: [4, 5] }),
      match({ played_on: "2026-10-02", our: [4, 6], opp: [5, 8] }),
      match({ played_on: "2026-10-03", our: [7, 6], opp: [4, 5] }),
      match({ played_on: "2026-10-04", our: [7, 6], opp: [4, 5] }),
    ];
    expect(currentStreak(rows)).toEqual({ result: "W", count: 2 });
  });
});

describe("sideStats", () => {
  it("uses the rounds of each half", () => {
    // We attack first: our T 7 + their CT 5 = 12 rounds; second half: our CT 6 + their T 4 = 10 rounds.
    const s = sideStats([match({ our: [7, 6], opp: [4, 5] })]);
    expect(s.t).toEqual({ won: 7, played: 12, rate: 7 / 12 });
    expect(s.ct).toEqual({ won: 6, played: 10, rate: 0.6 });
  });
});

describe("maps", () => {
  const rows = [
    ...[1, 2, 3].map(() => match({ map_id: "ascent", our: [7, 6], opp: [4, 5] })),
    ...[1, 2, 3].map(() => match({ map_id: "bind", our: [4, 6], opp: [5, 8] })),
    match({ map_id: "lotus", our: [7, 6], opp: [4, 5] }),
  ];
  it("groups by map", () => {
    const stats = mapStats(rows);
    expect(stats.find((s) => s.mapId === "ascent")).toMatchObject({ played: 3, wins: 3, winRate: 1 });
    expect(stats.find((s) => s.mapId === "lotus")).toMatchObject({ played: 1, smallSample: true });
  });
  it("only ranks maps with enough games", () => {
    const { strongest, weakest, eligibleCount } = strongestAndWeakest(mapStats(rows), 1);
    expect(eligibleCount).toBe(2);
    expect(strongest.map((s) => s.mapId)).toEqual(["ascent"]);
    expect(weakest.map((s) => s.mapId)).toEqual(["bind"]);
  });
  it("never lists the same map as strongest and weakest", () => {
    const { strongest, weakest } = strongestAndWeakest(mapStats(rows.slice(0, 3)), 2);
    expect(strongest).toHaveLength(1);
    expect(weakest).toHaveLength(0);
  });
});

describe("compositions", () => {
  it("treats the same five agents in any order as one composition", () => {
    const a = match({ our_agent_ids: ["jett", "sova", "killjoy", "omen", "kayo"], our: [7, 6], opp: [4, 5] });
    const b = match({ our_agent_ids: ["omen", "kayo", "jett", "killjoy", "sova"], our: [4, 6], opp: [5, 8] });
    const stats = compStats([a, b]);
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ played: 2, wins: 1, losses: 1, winRate: 0.5 });
  });
  it("counts agent picks once per map", () => {
    const usage = agentUsage([match({ our: [7, 6], opp: [4, 5] }), match({ our: [4, 6], opp: [5, 8] })]);
    expect(usage.find((u) => u.agentId === "jett")).toMatchObject({ picks: 2, pickRate: 1, wins: 1, winRate: 0.5 });
  });
});

describe("series", () => {
  it("rebuilds a BO3 from its maps", () => {
    const s = seriesResults([
      match({ series_id: "S1", series_format: "BO3", map_number: 1, our: [6, 7], opp: [5, 6] }),
      match({ series_id: "S1", series_format: "BO3", map_number: 2, our: [5, 6], opp: [6, 7] }),
      match({ series_id: "S1", series_format: "BO3", map_number: 3, match_type: "official", our: [5, 7, 2], opp: [5, 7, 0] }),
      match({ our: [7, 6], opp: [4, 5] }),
    ]);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ seriesId: "S1", format: "BO3", mapsWon: 2, mapsLost: 1, result: "W" });
  });
});

describe("formatting", () => {
  it("formats percentages and differences", () => {
    expect(formatPct(null)).toBe("—");
    expect(formatPct(0.6667)).toBe("67%");
    expect(formatDiff(4)).toBe("+4");
    expect(formatDiff(-3)).toBe("−3");
    expect(formatDiff(0)).toBe("0");
  });
});

describe("matchups and round types", () => {
  it("groups our comp against their comp", () => {
    const rows = [
      match({ opp_comp_key: "x", our: [7, 6], opp: [4, 5] }),
      match({ opp_comp_key: "x", our: [4, 6], opp: [5, 8] }),
      match({ opp_comp_key: "y", our: [7, 6], opp: [4, 5] }),
    ];
    const m = matchupStats(rows);
    expect(m[0]).toMatchObject({ oppKey: "x", played: 2, wins: 1, losses: 1 });
    expect(m[1]).toMatchObject({ oppKey: "y", played: 1, smallSample: true });
  });
  it("finds the best maps for a composition", () => {
    const rows = [
      match({ map_id: "ascent", our: [7, 6], opp: [4, 5] }),
      match({ map_id: "bind", our: [4, 6], opp: [5, 8] }),
    ];
    expect(bestMaps(rows, rows[0]!.our_comp_key).map((b) => b.mapId)).toEqual(["ascent"]);
  });
  it("ignores matches where a metric wasn't recorded", () => {
    const a = { ...match({ our: [7, 6], opp: [4, 5] }), pistols_won: 2, anti_eco_won: 3, anti_eco_played: 4 };
    const b = { ...match({ our: [4, 6], opp: [5, 8] }), pistols_won: 0 };
    const c = match({ our: [7, 6], opp: [4, 5] });
    const r = roundTypeMetrics([a, b, c]);
    expect(r.pistol).toMatchObject({ won: 2, total: 4, rate: 0.5, matches: 2 });
    expect(r.antiEco).toMatchObject({ won: 3, total: 4, matches: 1 });
    expect(r.bonus).toMatchObject({ total: 0, rate: null, matches: 0 });
  });
});
