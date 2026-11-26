import "server-only";
import type { Tx } from "../db";
import { newId, type Item, type Scene } from "../boards/scene";

/**
 * A full, fictional season for the portfolio showcase: a pro-style team with
 * scrims and officials across the rotation, per-player scoreboards,
 * strategies with their own boards, map gameplans, scouting, VOD reviews and
 * practice. Everything is generated from a fixed seed, so every install of
 * the showcase looks the same. No real players or teams.
 */

// Deterministic pseudo-random numbers (mulberry32).
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261126);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;

const ROTATION = ["Ascent", "Bind", "Haven", "Lotus", "Split", "Sunset", "Abyss"] as const;
type MapName = (typeof ROTATION)[number];

/** Our composition per map, as player → agent. */
const LINEUPS: Record<MapName, Record<string, string>> = {
  Ascent: { Vesper: "Jett", Kestrel: "Sova", Lumen: "Omen", Rook: "Killjoy", Sable: "KAY/O" },
  Bind: { Vesper: "Raze", Kestrel: "Skye", Lumen: "Brimstone", Quill: "Viper", Rook: "Cypher" },
  Haven: { Vesper: "Jett", Kestrel: "Sova", Lumen: "Omen", Rook: "Killjoy", Sable: "Breach" },
  Lotus: { Vesper: "Raze", Kestrel: "Fade", Lumen: "Omen", Rook: "Killjoy", Sable: "Breach" },
  Split: { Vesper: "Raze", Kestrel: "Skye", Lumen: "Omen", Quill: "Viper", Rook: "Cypher" },
  Sunset: { Vesper: "Raze", Kestrel: "Sova", Lumen: "Omen", Rook: "Cypher", Sable: "Breach" },
  Abyss: { Vesper: "Jett", Kestrel: "Sova", Lumen: "Omen", Rook: "Cypher", Sable: "KAY/O" },
};
const OPP_COMPS: string[][] = [
  ["Jett", "Sova", "Omen", "Killjoy", "Breach"],
  ["Raze", "Fade", "Astra", "Cypher", "KAY/O"],
  ["Neon", "Skye", "Viper", "Harbor", "Killjoy"],
  ["Raze", "Sova", "Brimstone", "Viper", "Cypher"],
  ["Yoru", "Gekko", "Clove", "Vyse", "Fade"],
  ["Jett", "Breach", "Omen", "Sage", "Sova"],
];
const OPPONENTS = [
  "Cobalt Reach",
  "Ironclad Syndicate",
  "Tidebreak Esports",
  "Ashfall Gaming",
  "Northwind Five",
  "Static Bloom",
  "Redline Arcana",
  "Verdant Ghosts",
];
const SKILL: Record<string, { kpr: number; apr: number; fk: number; fd: number; hs: number }> = {
  Vesper: { kpr: 0.86, apr: 0.2, fk: 0.13, fd: 0.11, hs: 27 },
  Kestrel: { kpr: 0.71, apr: 0.4, fk: 0.06, fd: 0.06, hs: 24 },
  Lumen: { kpr: 0.63, apr: 0.42, fk: 0.04, fd: 0.05, hs: 22 },
  Rook: { kpr: 0.67, apr: 0.27, fk: 0.05, fd: 0.05, hs: 25 },
  Sable: { kpr: 0.77, apr: 0.31, fk: 0.09, fd: 0.09, hs: 26 },
  Quill: { kpr: 0.61, apr: 0.36, fk: 0.04, fd: 0.05, hs: 21 },
};

/** Scores that respect the half rules: 12 rounds per half, 13 to win, no draws in officials. */
function score(win: boolean, startT: boolean, allowDraw: boolean) {
  if (allowDraw && rand() < 0.06) {
    const usH1 = int(4, 8);
    const half = [usH1, 12 - usH1, 12 - usH1, usH1];
    return assign(half, startT);
  }
  const loser = int(3, 11);
  // Winner's first half: enough that the loser's first half fits in their total.
  const winnerH1 = int(Math.max(1, 12 - loser), 12);
  const loserH1 = 12 - winnerH1;
  const winnerH2 = 13 - winnerH1;
  const loserH2 = loser - loserH1;
  const [us1, them1, us2, them2] = win
    ? [winnerH1, loserH1, winnerH2, loserH2]
    : [loserH1, winnerH1, loserH2, winnerH2];
  return assign([us1, them1, us2, them2], startT);
}
function assign([us1, them1, us2, them2]: number[], startT: boolean) {
  // First half we attack (startT) or defend; sides swap at half time.
  return startT
    ? { our_t: us1!, opp_ct: them1!, our_ct: us2!, opp_t: them2! }
    : { our_ct: us1!, opp_t: them1!, our_t: us2!, opp_ct: them2! };
}

type Pt = [number, number];
const CALLOUT: Record<string, Record<string, Pt>> = {
  Ascent: {
    "A Tree": [402, 303],
    "A Lobby": [599, 269],
    "A Main": [485, 213],
    "A Window": [252, 300],
    "A Site": [356, 157],
    "B Lobby": [708, 670],
    "B Main": [409, 704],
    "B Boat House": [280, 872],
    "Mid Bottom": [401, 495],
    "B Site": [294, 728],
    "Mid Catwalk": [524, 415],
    "Mid Cubby": [457, 343],
    "A Garden": [294, 317],
    "Mid Market": [307, 497],
    "Mid Courtyard": [493, 488],
    "Mid Link": [514, 613],
    "Mid Pizza": [313, 449],
    "A Rafters": [250, 158],
    "Mid Top": [658, 385],
    "A Wine": [486, 76],
    "Defender Side Spawn": [146, 436],
  },
  Bind: {
    "A Exit": [907, 521],
    "A Link": [517, 588],
    "A Lobby": [753, 603],
    "A Short": [619, 497],
    "A Site": [725, 340],
    "A Teleporter": [602, 415],
    "B Exit": [474, 444],
    "B Hall": [294, 214],
    "B Link": [425, 589],
    "B Fountain": [269, 624],
    "B Long": [205, 515],
    "B Short": [401, 528],
    "B Site": [300, 320],
    "B Window": [330, 449],
    "A Bath": [826, 433],
    "A Cubby": [584, 461],
    "B Elbow": [172, 314],
    "B Garden": [257, 431],
    "A Lamps": [578, 346],
    "A Tower": [719, 220],
  },
  Haven: {
    "A Garden": [732, 414],
    "A Link": [298, 331],
    "A Lobby": [619, 389],
    "A Long": [573, 190],
    "A Sewer": [500, 388],
    "A Site": [405, 183],
    "B Back": [302, 495],
    "B Site": [405, 501],
    "C Link": [349, 643],
    "C Lobby": [658, 755],
    "C Long": [638, 879],
    "C Garage": [494, 624],
    "C Window": [422, 638],
    "C Site": [421, 808],
    "C Cubby": [597, 790],
    "Mid Doors": [619, 626],
    "Mid Courtyard": [586, 506],
    "Mid Window": [669, 497],
    "A Tower": [316, 153],
  },
  Lotus: {
    "A Top": [805, 261],
    "A Site": [841, 366],
    "A Tree": [841, 476],
    "A Door": [816, 513],
    "A Main": [744, 536],
    "A Rubble": [797, 597],
    "A Root": [684, 597],
    "A Lobby": [659, 715],
    "B Main": [453, 564],
    "B Site": [503, 461],
    "A Link": [601, 486],
    "A Stairs": [723, 330],
    "C Mound": [348, 634],
    "C Main": [239, 534],
    "C Site": [162, 440],
    "C Hall": [162, 355],
    "C Lobby": [348, 804],
  },
};

const RED = "#ff4655";
const YELLOW = "#ffd166";
const WHITE = "#f2f4f7";

/** Small builder for board scenes, placing items by callout name. */
function board(map: string, build: (b: ReturnType<typeof builder>) => void): Scene {
  const b = builder(map);
  build(b);
  return { v: 1, bg: { kind: "map" }, rot: 0, callouts: true, items: b.items };
}
function builder(map: string) {
  const items: Item[] = [];
  const at = (where: string | Pt, dx = 0, dy = 0): Pt => {
    const p = typeof where === "string" ? CALLOUT[map]?.[where] : where;
    if (!p) throw new Error(`Unknown callout ${map}/${String(where)}`);
    return [p[0] + dx, p[1] + dy];
  };
  return {
    items,
    agent(agent: string, where: string | Pt, team: "ally" | "enemy" = "ally", dx = 0, dy = 0) {
      const [x, y] = at(where, dx, dy);
      items.push({ id: newId(), t: "agent", agent, x, y, team, s: 1, r: 0 });
    },
    util(
      agent: string,
      slot: string,
      where: string | Pt,
      opts: { dir?: number; dx?: number; dy?: number; team?: "ally" | "enemy" } = {},
    ) {
      const [x, y] = at(where, opts.dx ?? 0, opts.dy ?? 0);
      items.push({
        id: newId(),
        t: "ability",
        agent,
        slot,
        x,
        y,
        team: opts.team ?? "ally",
        s: 0.7,
        r: 0,
        area: true,
        dir: opts.dir ?? 0,
        reach: 1,
      });
    },
    arrow(from: string | Pt, to: string | Pt, color = WHITE, dash = false) {
      const [x1, y1] = at(from);
      const [x2, y2] = at(to);
      items.push({ id: newId(), t: "arrow", x1, y1, x2, y2, color, w: 6, dash, head: true });
    },
    step(n: number, where: string | Pt, dx = 0, dy = 0) {
      const [x, y] = at(where, dx, dy);
      items.push({ id: newId(), t: "step", n, x, y, color: YELLOW, s: 1, r: 0 });
    },
    spike(where: string | Pt, dx = 0, dy = 0) {
      const [x, y] = at(where, dx, dy);
      items.push({ id: newId(), t: "marker", kind: "spike", x, y, color: RED, s: 1, r: 0 });
    },
    text(text: string, where: string | Pt, dx = 0, dy = 0) {
      const [x, y] = at(where, dx, dy);
      items.push({ id: newId(), t: "text", x, y, text, color: WHITE, s: 0.8, r: 0 });
    },
  };
}

type StrategySeed = {
  map: MapName;
  side: "t" | "ct";
  category: string;
  name: string;
  status: "approved" | "practicing" | "in_development";
  description: string;
  objective: string;
  strong: string;
  weak: string;
  execution: string;
  board: Scene;
};

const STRATEGIES: StrategySeed[] = [
  {
    map: "Ascent",
    side: "t",
    category: "split",
    name: "A split: Main + Tree",
    status: "approved",
    description:
      "Mid control into an A split. Omen smokes Heaven and Rafters, Sova clears Garden with recon, KAY/O knife on A Site. Jett dashes in from Main while Sable and Rook push through Tree.",
    objective: "Take A Site with three through Main and two through Tree; plant default for Tree crossfire.",
    strong:
      "Splits CT attention between Main and Tree\nRecon + knife leaves no safe angle on site\nPost-plant crossfire from Tree and Main",
    weak: "Slow if mid is lost early\nWeak to a Killjoy ult retake\nNeeds Omen alive for both smokes",
    execution:
      "Take mid with Sova dart at 1:30\nOmen smokes Heaven and Rafters\nKnife A Site, Jett dash on knife pop\nTree group swings on Jett entry\nPlant default, Killjoy turret watches Garden",
    board: board("Ascent", (b) => {
      b.agent("Jett", "A Lobby", "ally", 10, 30);
      b.agent("Sova", "A Lobby", "ally", 60, 10);
      b.agent("Omen", "Mid Top", "ally", 0, 30);
      b.agent("Killjoy", "Mid Catwalk", "ally", 20, 10);
      b.agent("KAY/O", "Mid Catwalk", "ally", -30, 30);
      b.util("Omen", "Ability2", "A Rafters");
      b.util("Omen", "Ability2", "A Window", { dx: 20 });
      b.util("Sova", "Ability2", "A Garden", { dx: 10 });
      b.util("KAY/O", "Ability2", "A Site", { dx: 20, dy: 20 });
      b.arrow("A Lobby", "A Main", RED);
      b.arrow("A Main", "A Site", RED);
      b.arrow("Mid Catwalk", "A Tree", WHITE, true);
      b.arrow("A Tree", "A Garden", WHITE, true);
      b.spike("A Site", 30, 40);
      b.step(1, "Mid Top", 40, -30);
      b.step(2, "A Main", 30, 20);
      b.step(3, "A Tree", -30, 30);
      b.agent("Killjoy", "A Site", "enemy", -40, -30);
      b.agent("Cypher", "A Garden", "enemy", -20, 20);
    }),
  },
  {
    map: "Ascent",
    side: "ct",
    category: "site_setup",
    name: "2-1-2 with mid Killjoy",
    status: "approved",
    description:
      "Two A, one mid, two B. Killjoy anchors mid with turret on Catwalk and alarmbot at Market so B and A can rotate on info.",
    objective: "Win mid info for free and rotate early instead of stacking.",
    strong: "Mid info without risking a duel\nFast rotations through Market\nWorks against defaults and fast hits",
    weak: "A is light against a full A execute\nKilljoy can get flushed by Breach stun\nNeeds disciplined calls on rotations",
    execution:
      "Killjoy setup Catwalk turret, Market alarmbot\nA players hold Heaven and Generator\nB players hold Main and Boathouse\nRotate on second contact, not first",
    board: board("Ascent", (b) => {
      b.agent("Killjoy", "Mid Market", "ally", 10, -20);
      b.util("Killjoy", "Ability2", "Mid Pizza", { dir: -20 });
      b.util("Killjoy", "Ability1", "Mid Market", { dx: 40 });
      b.agent("Omen", "A Rafters", "ally", 10, 20);
      b.agent("Jett", "A Site", "ally", 30, 40);
      b.agent("Sova", "B Site", "ally", 30, -10);
      b.agent("KAY/O", "B Site", "ally", -30, 60);
      b.util("Sova", "Ability2", "B Main", { dx: 30 });
      b.arrow("Mid Market", "A Garden", WHITE, true);
      b.arrow("Mid Market", "B Site", WHITE, true);
      b.text("Rotate on 2nd contact", "Mid Courtyard", 30, 70);
    }),
  },
  {
    map: "Bind",
    side: "t",
    category: "execute",
    name: "B Long execute",
    status: "practicing",
    description:
      "Viper wall from Long to Site, Brimstone smokes Elbow and Hall, Skye flashes over the wall. Raze clears Garden with paint shells and entries first.",
    objective: "Plant B default behind the wall and hold Elbow + Hall with two.",
    strong: "Viper wall cuts site in half\nRaze utility clears close angles\nHard to retake through smokes",
    weak: "Slow start lets them stack B\nWeak to a Cypher trap in Long\nIf Raze dies first, the hit stalls",
    execution:
      "Two gather in Long, one lurks Hookah\nViper wall at 1:05, smokes Elbow and Hall\nSkye flash, Raze satchel in\nPlant default, Viper ult if retake",
    board: board("Bind", (b) => {
      b.agent("Raze", "B Long", "ally", 10, 40);
      b.agent("Skye", "B Long", "ally", -30, 70);
      b.agent("Viper", "B Long", "ally", 40, 80);
      b.agent("Brimstone", "B Fountain", "ally", 10, 20);
      b.agent("Cypher", "B Window", "ally", 40, 40);
      b.util("Viper", "Ability2", "B Long", { dir: -70, dx: 20 });
      b.util("Brimstone", "Ability2", "B Elbow");
      b.util("Brimstone", "Ability2", "B Hall", { dy: 20 });
      b.util("Raze", "Ability2", "B Garden");
      b.arrow("B Long", "B Site", RED);
      b.arrow("B Window", "B Garden", WHITE, true);
      b.spike("B Site", 20, 20);
      b.agent("Cypher", "B Site", "enemy", -30, -40);
    }),
  },
  {
    map: "Haven",
    side: "t",
    category: "execute",
    name: "C Long hit",
    status: "approved",
    description:
      "Breach Fault Line through C Long, Omen smokes Link and Window, Sova shock dart on Cubby. Jett dashes on the stun.",
    objective: "Fast C take before the B player can rotate through Link.",
    strong: "Stun covers the whole C Long choke\nSmokes cut both rotation paths\nWorks on low buy with Sheriff entries",
    weak: "Easy read after two in a row\nWeak to Killjoy lockdown in C\nGarage push can catch the lurker",
    execution:
      "Group in C Long at 1:20\nOmen smokes C Link and C Window\nBreach stun down Long, Jett dash\nPlant default, two hold Garage and Link",
    board: board("Haven", (b) => {
      b.agent("Jett", "C Long", "ally", 10, -10);
      b.agent("Breach", "C Long", "ally", 50, 20);
      b.agent("Sova", "C Lobby", "ally", 10, 20);
      b.agent("Omen", "C Lobby", "ally", -40, 30);
      b.agent("Killjoy", "Mid Doors", "ally", 20, 20);
      b.util("Breach", "Ability2", "C Long", { dir: 180, dx: 40 });
      b.util("Omen", "Ability2", "C Link");
      b.util("Omen", "Ability2", "C Window", { dx: -10 });
      b.util("Sova", "Ability1", "C Cubby");
      b.arrow("C Long", "C Site", RED);
      b.spike("C Site", 10, -20);
      b.step(1, "C Lobby", 40, -40);
      b.step(2, "C Long", -60, -30);
    }),
  },
  {
    map: "Lotus",
    side: "ct",
    category: "retake",
    name: "A retake through Link",
    status: "practicing",
    description:
      "Killjoy lockdown from Stairs to deny the post-plant, Fade haunt for info, Omen smokes Rubble and Root; three retake through Link and Stairs.",
    objective: "Retake A with lockdown before they can set a crossfire.",
    strong:
      "Lockdown forces them off the spike\nHaunt reveals the post-plant spots\nTwo angles at once from Link and Stairs",
    weak: "Needs lockdown and three players alive\nRubble flank if the smoke drops early",
    execution:
      "Fade haunt from Stairs\nKilljoy lockdown on the spike\nOmen smokes Rubble and Root\nLink and Stairs swing together",
    board: board("Lotus", (b) => {
      b.agent("Killjoy", "A Stairs", "ally", -30, 10);
      b.util("Killjoy", "Ultimate", "A Stairs", { dx: 40 });
      b.agent("Fade", "A Stairs", "ally", 10, -30);
      b.util("Fade", "Ability2", "A Site");
      b.agent("Omen", "A Link", "ally", -20, 20);
      b.util("Omen", "Ability2", "A Rubble");
      b.util("Omen", "Ability2", "A Root");
      b.arrow("A Link", "A Tree", WHITE);
      b.arrow("A Stairs", "A Site", WHITE);
      b.spike("A Site", 0, 40);
      b.agent("Raze", "A Tree", "enemy", 10, 10);
      b.agent("Breach", "A Door", "enemy", 0, 10);
    }),
  },
];

const MAP_PLANS: Partial<
  Record<
    MapName,
    {
      attack: string;
      defense: string;
      reading: string;
      strengths: string;
      weaknesses: string;
      boards: { title: string; scene: Scene }[];
    }
  >
> = {
  Ascent: {
    attack:
      "Default with mid control: Sova dart Catwalk, Jett and KAY/O take Courtyard. From mid we choose: A split through Tree or B fast through Market.\nOn pistol: 4 A Main with KAY/O flash, Omen lurks mid.",
    defense:
      "2-1-2 with Killjoy mid. Rotate on second contact. Omen plays A Heaven with one-way smokes; retake A with Killjoy ult if we lose it.",
    reading:
      "Mid decides Ascent: whoever controls Courtyard and Catwalk dictates both sites. Market is the fastest rotation for both teams; doors in A and B change timings late in rounds.\nKey timings: first mid contact around 1:30; A lobby to site in 6 seconds with Jett dash.",
    strengths: "Mid fights with Jett + KAY/O\nA retakes with Killjoy ult\nPost-plant discipline on A",
    weaknesses:
      "Slow B rotations through Market\nLosing pistol rounds on defense\nOverpeeking Catwalk after first kill",
    boards: [
      {
        title: "Mid control default",
        scene: board("Ascent", (b) => {
          b.agent("Jett", "Mid Courtyard", "ally", 20, 0);
          b.agent("KAY/O", "Mid Top", "ally", 0, 30);
          b.agent("Sova", "A Lobby", "ally", 40, 30);
          b.agent("Omen", "B Lobby", "ally", 0, -30);
          b.agent("Killjoy", "B Lobby", "ally", 30, 10);
          b.util("Sova", "Ability2", "Mid Catwalk");
          b.util("Omen", "Ability2", "Mid Market", { dx: 30 });
          b.arrow("Mid Top", "Mid Courtyard", WHITE);
          b.arrow("Mid Courtyard", "Mid Catwalk", WHITE, true);
          b.text("Decide after mid", "Mid Bottom", 60, 40);
        }),
      },
    ],
  },
  Bind: {
    attack:
      "Slow default with Raze in Hookah, Viper holding Long. Executes come late (1:05) through B Long or A Short with teleporter fakes.",
    defense: "Cypher B with trips in Long, Viper A with the wall ready. Brimstone rotates through the middle on info.",
    reading:
      "Bind has no mid: rotations go through the sites or the spawn, so information decides retakes. Teleporters create fakes; one sound in TP changes the defense.\nHookah and Showers are the fights that open each site.",
    strengths: "Late-round executes with full utility\nPost-plants behind Viper's wall",
    weaknesses: "Short fights in Hookah\nForgetting to play the teleporter fake",
    boards: [],
  },
  Haven: {
    attack:
      "Three-site pressure: take mid courtyard early, then hit the site with the fewest defenders. C Long is our main hit.",
    defense: "1-1-1-2: one per site, two flex from mid. Killjoy C with lockdown for retakes.",
    reading:
      "Three sites stretch defenders thin; mid courtyard and garage are the links. Fast info on C decides most rounds.",
    strengths: "C executes\nTrading in mid courtyard",
    weaknesses: "A Long fights without utility",
    boards: [],
  },
  Lotus: {
    attack:
      "Rotating doors let us fake: open A Door, hit C through Mound. Breach stuns are our entry tool on every site.",
    defense: "Killjoy A, Omen and Fade play B and flex. Retake A through Link and Stairs with lockdown.",
    reading:
      "The rotating doors are timing tools: open them to fake. A is the biggest site and the hardest to hold alone.",
    strengths: "Retakes with Killjoy lockdown",
    weaknesses: "Defending C alone",
    boards: [],
  },
};

export async function seedShowcase(tx: Tx): Promise<void> {
  const agents = new Map(
    (await tx<{ id: string; name: string }[]>`select id, name from public.agents`).map((a) => [
      a.name.toLowerCase(),
      a.id,
    ]),
  );
  const agentId = (name: string) => {
    const id = agents.get(name.toLowerCase());
    if (!id) throw new Error(`Showcase agent missing: ${name}`);
    return id;
  };
  const maps = new Map(
    (await tx<{ id: string; name: string }[]>`select id, name from public.maps`).map((m) => [m.name, m.id]),
  );
  const players = new Map(
    (await tx<{ id: string; nickname: string }[]>`select id, nickname from public.players`).map((p) => [
      p.nickname,
      p.id,
    ]),
  );

  await tx`update public.maps set in_rotation = name = any(${[...ROTATION]})`;

  // Opponents
  const opponents: string[] = [];
  for (const name of OPPONENTS) {
    const [o] = await tx<{ id: string }[]>`insert into public.opponents (name) values (${name}) returning id`;
    opponents.push(o!.id);
  }

  // Player profiles
  const details: Record<string, [string, string]> = {
    Vesper: ["Space-making entries and fast trades", "Overextends after the first kill"],
    Kestrel: ["Clean recon lineups, calm mid-round calls", "Dry peeks when the info is already there"],
    Lumen: ["One-way smokes and timing", "Positioning in retakes"],
    Rook: ["Anchoring alone with utility", "Late rotations"],
    Sable: ["Second entry, refrags", "Utility usage on defense"],
    Quill: ["Viper lineups and post-plants", "Aim duels at range"],
  };
  for (const [nick, [s, w]] of Object.entries(details)) {
    const id = players.get(nick);
    if (id) await tx`update public.player_details set strengths = ${s}, weaknesses = ${w} where player_id = ${id}`;
  }
  const pool: Record<string, [string[], string[]]> = {
    Vesper: [
      ["Jett", "Raze"],
      ["Neon", "Yoru"],
    ],
    Kestrel: [["Sova", "Skye"], ["Fade"]],
    Lumen: [["Omen", "Brimstone"], ["Astra"]],
    Rook: [["Killjoy", "Cypher"], ["Sage"]],
    Sable: [["Breach", "KAY/O"], ["Raze"]],
    Quill: [["Viper"], ["Harbor", "Cypher"]],
  };
  for (const [nick, [main, sec]] of Object.entries(pool)) {
    const id = players.get(nick);
    if (id)
      await tx`update public.players set main_agent_ids = ${main.map(agentId)}, secondary_agent_ids = ${sec.map(agentId)} where id = ${id}`;
  }

  // A season of matches: scrims most weeks, officials on weekends, some BO3 series.
  const start = new Date(Date.UTC(2026, 8, 7)); // 7 Sep 2026
  const matchIds: { id: string; map: MapName; official: boolean }[] = [];
  let series = 0;
  for (let week = 0; week < 11; week++) {
    const monday = new Date(start.getTime() + week * 7 * 86400000);
    // Two scrim maps on Tuesday and Thursday
    for (const day of [1, 3]) {
      const map = pick(ROTATION);
      matchIds.push(await addMatch(tx, { date: addDays(monday, day), map, type: "scrim", opponent: pick(opponents) }));
    }
    // Weekend official: BO3 every other week, BO1 otherwise
    const official = addDays(monday, 5);
    const opp = pick(opponents);
    if (week % 2 === 0) {
      series++;
      const seriesId = `S${week + 1}-${series}`;
      const picks = [...ROTATION].sort(() => rand() - 0.5).slice(0, 3);
      let us = 0;
      let them = 0;
      for (let i = 0; i < 3 && us < 2 && them < 2; i++) {
        const m = await addMatch(tx, {
          date: official,
          map: picks[i]!,
          type: week >= 6 ? "tournament" : "official",
          opponent: opp,
          series: { id: seriesId, n: i + 1 },
        });
        matchIds.push(m);
        if (m.win) us++;
        else them++;
      }
    } else {
      matchIds.push(await addMatch(tx, { date: official, map: pick(ROTATION), type: "official", opponent: opp }));
    }
  }

  async function addMatch(
    t: Tx,
    m: {
      date: Date;
      map: MapName;
      type: "scrim" | "official" | "tournament";
      opponent: string;
      series?: { id: string; n: number };
    },
  ) {
    const win = rand() < (m.type === "scrim" ? 0.6 : 0.64);
    const rounds = score(win, rand() < 0.5, m.type === "scrim");
    const lineup = LINEUPS[m.map];
    const ours = Object.values(lineup).map(agentId);
    const opp = pick(OPP_COMPS).map(agentId);
    const firstBloods = int(8, 15);
    const [row] = await t<{ id: string; result: string; our_score: number; opp_score: number }[]>`
      insert into public.matches (played_on, competition, match_type, opponent_id, series_id, series_format, map_number,
        map_id, our_agent_ids, opp_agent_ids, our_t_rounds, our_ct_rounds, opp_t_rounds, opp_ct_rounds,
        pistols_won, first_bloods, first_blood_wins)
      values (${m.date.toISOString().slice(0, 10)},
        ${m.type === "scrim" ? null : m.type === "tournament" ? "Meridian Invitational" : "Pro League Stage 2"},
        ${m.type}, ${m.opponent}, ${m.series?.id ?? null}, ${m.series ? "BO3" : null}, ${m.series?.n ?? null},
        ${maps.get(m.map)!}, ${ours}, ${opp}, ${rounds.our_t}, ${rounds.our_ct}, ${rounds.opp_t}, ${rounds.opp_ct},
        ${int(0, 2)}, ${firstBloods}, ${int(Math.round(firstBloods * 0.45), firstBloods)})
      returning id, result, our_score, opp_score`;
    const total = row!.our_score + row!.opp_score;
    const won = row!.result === "W";
    for (const [nick, agent] of Object.entries(lineup)) {
      const pid = players.get(nick);
      if (!pid) continue;
      const k = SKILL[nick]!;
      // Each player is better on some agents and maps than others, so comparisons tell a story.
      const form = between(0.82, 1.18) * (won ? 1.07 : 0.93) * affinity(nick, agent, 0.16) * affinity(nick, m.map, 0.1);
      const kills = Math.round(total * k.kpr * form);
      const deaths = Math.round(total * between(0.62, 0.78) * (won ? 0.92 : 1.08));
      const assists = Math.round(total * k.apr * between(0.75, 1.25));
      const acs = Math.round((kills / total) * 255 + (assists / total) * 55 + between(-12, 18));
      const adr = Math.round(acs * between(0.6, 0.68) * 10) / 10;
      const hs = Math.round((k.hs + between(-5, 6)) * 10) / 10;
      await t`
        insert into public.match_player_stats (match_id, player_id, agent_id, kills, deaths, assists, acs, adr, hs_pct, first_kills, first_deaths)
        values (${row!.id}, ${pid}, ${agentId(agent)}, ${kills}, ${deaths}, ${assists}, ${acs}, ${adr}, ${hs},
          ${Math.round(total * k.fk * between(0.6, 1.4))}, ${Math.round(total * k.fd * between(0.6, 1.4))})`;
    }
    return { id: row!.id, map: m.map, official: m.type !== "scrim", win: won };
  }

  // Strategies, each with its own board
  for (const s of STRATEGIES) {
    const lineup = LINEUPS[s.map];
    const comp = Object.values(lineup).map(agentId);
    const assignments = Object.entries(lineup).map(([nick, agent]) => ({
      player_id: players.get(nick) ?? null,
      agent_id: agentId(agent),
      task: null,
    }));
    const [row] = await tx<{ id: string }[]>`
      insert into public.strategies (map_id, side, category, name, description, objective, comp_agent_ids, assignments,
        execution, strong_points, weak_points, status)
      values (${maps.get(s.map)!}, ${s.side}, ${s.category}, ${s.name}, ${s.description}, ${s.objective}, ${comp},
        ${tx.json(assignments)}, ${s.execution}, ${s.strong}, ${s.weak}, ${s.status})
      returning id`;
    await tx`
      insert into public.boards (title, map_id, side, scene, strategy_id)
      values (${s.name}, ${maps.get(s.map)!}, ${s.side === "t" ? "attack" : "defense"}, ${tx.json(s.board)}, ${row!.id})`;
  }

  // Map gameplans and map boards
  for (const [map, plan] of Object.entries(MAP_PLANS)) {
    if (!plan) continue;
    const mapId = maps.get(map)!;
    await tx`
      insert into public.map_notes (map_id, gameplan_attack, gameplan_defense, map_reading, strengths, weaknesses, recommended_comps)
      values (${mapId}, ${plan.attack}, ${plan.defense}, ${plan.reading}, ${plan.strengths}, ${plan.weaknesses},
        ${Object.values(LINEUPS[map as MapName]).join(", ")})
      on conflict (map_id) do update set gameplan_attack = excluded.gameplan_attack, gameplan_defense = excluded.gameplan_defense,
        map_reading = excluded.map_reading, strengths = excluded.strengths, weaknesses = excluded.weaknesses,
        recommended_comps = excluded.recommended_comps`;
    for (const b of plan.boards) {
      await tx`insert into public.boards (title, map_id, scene) values (${b.title}, ${mapId}, ${tx.json(b.scene)})`;
    }
  }

  // Scouting notes
  const scoutNotes = [
    "Fast A executes on Ascent, almost no mid presence. Stack A after first contact.",
    "Slow defaults, plays for picks. Their Jett lurks mid on attack.",
    "Strong pistol rounds; force-buys round 2 often.",
  ];
  for (let i = 0; i < scoutNotes.length; i++) {
    await tx`insert into public.opponent_notes (opponent_id, notes) values (${opponents[i]!}, ${scoutNotes[i]!})
      on conflict (opponent_id) do update set notes = excluded.notes`;
  }

  // VOD reviews on recent officials
  const recent = matchIds.filter((m) => m.official).slice(-4);
  const vods = [
    [
      "Positioning",
      "Vesper",
      "Took the duel at Catwalk without the dart; died first and we lost mid.",
      "Wait for Sova's recon, then swing together with KAY/O.",
      "resolved",
    ],
    [
      "Utility usage",
      "Lumen",
      "Both smokes went down before the entry was ready; site re-opened.",
      "Smoke on the 'go' call, not on arrival.",
      "open",
    ],
    [
      "Communication",
      "Rook",
      "Rotation call came after the plant; B retake was 3v5.",
      "Call 'rotate' on second contact, as the gameplan says.",
      "in_progress",
    ],
    [
      "Decision making",
      "Sable",
      "Re-peeked after the first kill instead of trading position.",
      "Fall back to the post-plant spot after a kill.",
      "open",
    ],
  ] as const;
  for (let i = 0; i < Math.min(recent.length, vods.length); i++) {
    const [category, nick, what, should, status] = vods[i]!;
    await tx`
      insert into public.vod_reviews (match_id, map_id, round_number, video_timestamp, player_id, category, what_happened,
        should_have_happened, improvement_action, assigned_player_id, status)
      values (${recent[i]!.id}, ${maps.get(recent[i]!.map)!}, ${int(3, 20)}, ${`${int(5, 38)}:${String(int(0, 59)).padStart(2, "0")}`},
        ${players.get(nick)!}, ${category}, ${what}, ${should}, ${should}, ${players.get(nick)!}, ${status})`;
  }

  // Practice: completed sessions in the past, planned ones ahead
  const strategyIds = await tx<{ id: string; map_id: string }[]>`select id, map_id from public.strategies`;
  const everyone = [...players.values()];
  for (let d = -9; d <= 9; d += 3) {
    const s = strategyIds[Math.abs(d) % strategyIds.length]!;
    const startsAt = new Date(Date.now() + d * 86400000);
    startsAt.setUTCHours(18, 0, 0, 0);
    const done = d < 0;
    await tx`
      insert into public.practice_sessions (starts_at, duration_min, session_type, map_id, strategy_id, objective,
        attending_player_ids, status, outcome)
      values (${startsAt}, ${pick([120, 150, 180])}, ${d % 2 ? "Strategy practice" : "Scrim block"}, ${s.map_id}, ${s.id},
        ${"Run the strategy five times from both spawns; fix timings."}, ${everyone}, ${done ? "completed" : "planned"},
        ${done ? "Timings are clean; utility still early on the second run." : null})`;
  }
}

/** A stable factor around 1 (±spread) for a player on an agent or map. */
function affinity(player: string, thing: string, spread: number) {
  let h = 2166136261;
  for (const ch of `${player}:${thing}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return 1 - spread + (((h >>> 0) % 1000) / 1000) * spread * 2;
}

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86400000);
}
