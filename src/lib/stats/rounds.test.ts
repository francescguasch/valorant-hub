import { describe, expect, it } from "vitest";
import { scoreOf, validateRounds, type RoundsInput } from "./rounds";

const r = (p: Partial<RoundsInput>): RoundsInput => ({ type: "official", ourT: 7, ourCT: 6, oppT: 4, oppCT: 5, ourOT: 0, oppOT: 0, ...p });

describe("scoreOf", () => {
  it("adds T, CT and overtime rounds", () => {
    expect(scoreOf(r({}))).toEqual({ our: 13, opp: 9, diff: 4, result: "W" });
    expect(scoreOf(r({ ourT: 5, ourCT: 7, oppT: 5, oppCT: 7, ourOT: 1, oppOT: 3 }))).toEqual({ our: 13, opp: 15, diff: -2, result: "L" });
    expect(scoreOf(r({ type: "scrim", ourT: 6, ourCT: 6, oppT: 6, oppCT: 6 })).result).toBe("D");
  });
});

describe("validateRounds", () => {
  it("accepts normal official results", () => {
    expect(validateRounds(r({}))).toBeNull();
    expect(validateRounds(r({ ourT: 3, ourCT: 4, oppT: 4, oppCT: 9 }))).toBeNull(); // 7–13
  });
  it("accepts overtime that ends 2 rounds apart", () => {
    expect(validateRounds(r({ ourT: 5, ourCT: 7, oppT: 5, oppCT: 7, ourOT: 2, oppOT: 0 }))).toBeNull();
    expect(validateRounds(r({ ourT: 5, ourCT: 7, oppT: 5, oppCT: 7, ourOT: 4, oppOT: 2 }))).toBeNull();
  });
  it("accepts both scrim formats, including 24-round draws", () => {
    expect(validateRounds(r({ type: "scrim", ourT: 7, ourCT: 7, oppT: 5, oppCT: 5 }))).toBeNull(); // 14–10
    expect(validateRounds(r({ type: "scrim", ourT: 6, ourCT: 6, oppT: 6, oppCT: 6 }))).toBeNull(); // 12–12
  });
  it("rejects impossible halves", () => expect(validateRounds(r({ ourT: 9, oppCT: 5 }))).toMatch(/at most 12/));
  it("rejects overtime in scrims", () => expect(validateRounds(r({ type: "scrim", ourOT: 2 }))).toMatch(/Scrims/));
  it("requires overtime at 12–12 in official matches", () =>
    expect(validateRounds(r({ ourT: 6, ourCT: 6, oppT: 6, oppCT: 6 }))).toMatch(/overtime/));
  it("rejects unfinished official maps", () => expect(validateRounds(r({ ourT: 5, ourCT: 5, oppT: 4, oppCT: 5 }))).toMatch(/reaches 13/));
  it("rejects overtime without a 12–12", () => expect(validateRounds(r({ ourOT: 2 }))).toMatch(/12–12/));
  it("rejects tied overtime", () =>
    expect(validateRounds(r({ ourT: 5, ourCT: 7, oppT: 5, oppCT: 7, ourOT: 2, oppOT: 2 }))).toMatch(/winner/));
});
