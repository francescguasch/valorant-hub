/** Score rules for one map, shared by the match form (live preview) and the server (validation). */

export type RoundsInput = {
  type: "scrim" | "official" | "tournament";
  ourT: number;
  ourCT: number;
  oppT: number;
  oppCT: number;
  ourOT: number;
  oppOT: number;
};

export function scoreOf(r: RoundsInput) {
  const our = r.ourT + r.ourCT + r.ourOT;
  const opp = r.oppT + r.oppCT + r.oppOT;
  return { our, opp, diff: our - opp, result: (our > opp ? "W" : our < opp ? "L" : "D") as "W" | "L" | "D" };
}

/** Returns a sentence explaining what is wrong, or null when the score is possible. */
export function validateRounds(r: RoundsInput): string | null {
  const values = [r.ourT, r.ourCT, r.oppT, r.oppCT, r.ourOT, r.oppOT];
  if (values.some((v) => !Number.isInteger(v) || v < 0)) return "Rounds must be whole numbers, 0 or more.";
  if ([r.ourT, r.ourCT, r.oppT, r.oppCT].some((v) => v > 12)) return "A side can win at most 12 rounds in regulation.";
  if (r.ourT + r.oppCT > 12) return "The half where you attack has at most 12 rounds: your T rounds plus their CT rounds.";
  if (r.ourCT + r.oppT > 12) return "The half where you defend has at most 12 rounds: your CT rounds plus their T rounds.";

  const ourReg = r.ourT + r.ourCT;
  const oppReg = r.oppT + r.oppCT;
  const hasOT = r.ourOT > 0 || r.oppOT > 0;

  if (r.type === "scrim") {
    if (hasOT) return "Scrims don't have overtime.";
    if (ourReg + oppReg === 0) return "Enter the rounds each team won.";
    return null;
  }

  if (hasOT) {
    if (ourReg !== 12 || oppReg !== 12) return "Overtime only happens after 12–12 in regulation.";
    if (r.ourOT === r.oppOT) return "Overtime must have a winner.";
    if (Math.abs(r.ourOT - r.oppOT) > 2) return "Overtime ends as soon as a team leads by 2 rounds.";
    return null;
  }
  if (ourReg === 12 && oppReg === 12) return "It's 12–12: add the overtime rounds.";
  const regulationWin = (ourReg === 13 && oppReg <= 11) || (oppReg === 13 && ourReg <= 11);
  if (!regulationWin) return "Official and tournament maps end when a team reaches 13 (or go to overtime at 12–12).";
  return null;
}
