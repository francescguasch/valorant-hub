import type { BoardAgent, ItemOf } from "./scene";

/**
 * The area each ability covers, drawn under its icon the way ValoPlant does:
 * smokes, mollies, walls, cones and reveal ranges. Sizes are in metres and
 * approximate (from in-game values); coaches can stretch and turn each one.
 * Keyed by the ability's name as valorant-api.com spells it, lower-cased; for
 * names like "Nebula / Dissipate" the part before the slash is used.
 */
export type AreaStyle = "smoke" | "zone" | "wall" | "reveal";
export type AreaSpec = (
  | { kind: "circle"; r: number; style: AreaStyle }
  | { kind: "wall"; length: number; width: number; from: "center" | "origin"; style: AreaStyle }
  | { kind: "rect"; length: number; width: number; style: AreaStyle }
  | { kind: "cone"; range: number; angle: number; style: AreaStyle }
  | { kind: "lane"; length: number; gap: number; style: AreaStyle }
  | { kind: "cross"; length: number; style: AreaStyle }
) & {
  /**
   * Metres the length (or radius) can take in game, for abilities whose size
   * depends on how they're used (Fault Line, trapwire, High Tide…). Without it
   * the size is fixed: the board always draws the in-game size.
   */
  adjust?: [number, number];
};

const circle = (r: number, style: AreaStyle = "zone"): AreaSpec => ({ kind: "circle", r, style });
const smoke = (r: number): AreaSpec => ({ kind: "circle", r, style: "smoke" });
const reveal = (r: number): AreaSpec => ({ kind: "circle", r, style: "reveal" });
const wall = (length: number, width: number, from: "center" | "origin"): AreaSpec => ({
  kind: "wall",
  length,
  width,
  from,
  style: "wall",
});
const rect = (length: number, width: number): AreaSpec => ({ kind: "rect", length, width, style: "zone" });
const adjustable = (spec: AreaSpec, min: number, max: number): AreaSpec => ({ ...spec, adjust: [min, max] });
const cone = (range: number, angle: number, style: AreaStyle = "reveal"): AreaSpec => ({
  kind: "cone",
  range,
  angle,
  style,
});

export const ABILITY_AREAS: Record<string, AreaSpec> = {
  // Astra
  "gravity well": circle(4.75),
  "nova pulse": circle(4.75),
  nebula: smoke(4.75),
  "cosmic divide": adjustable(wall(120, 1.2, "center"), 20, 160),
  "astral form": adjustable(wall(120, 1.2, "center"), 20, 160),
  // Breach
  aftershock: circle(3),
  "fault line": adjustable(rect(26, 8), 9, 46),
  "rolling thunder": cone(32, 60, "zone"),
  // Brimstone
  "stim beacon": circle(6),
  incendiary: circle(4.5),
  "sky smoke": smoke(4.1),
  "orbital strike": circle(9.5),
  // Chamber
  trademark: reveal(15),
  rendezvous: reveal(13),
  // Clove
  meddle: circle(6),
  ruse: smoke(4),
  // Cypher
  trapwire: adjustable(wall(12, 0.4, "center"), 2, 15),
  "cyber cage": smoke(3.7),
  spycam: cone(30, 90),
  // Deadlock
  gravnet: circle(6),
  "sonic sensor": cone(9, 90),
  "barrier mesh": { kind: "cross", length: 9, style: "wall" },
  annihilation: rect(30, 1.5),
  // Fade
  seize: circle(6),
  haunt: reveal(30),
  nightfall: rect(40, 30),
  // Gekko
  "mosh pit": circle(6.5),
  thrash: circle(6.5),
  // Harbor
  cascade: wall(12, 1.5, "center"),
  "storm surge": circle(6),
  cove: smoke(4.5),
  "high tide": adjustable(wall(50, 1, "origin"), 8, 50),
  reckoning: rect(30, 15),
  // Iso
  contingency: wall(6, 1, "center"),
  undercut: rect(25, 2),
  "kill contract": rect(30, 4),
  // Jett
  cloudburst: smoke(3.35),
  // KAY/O
  "frag/ment": circle(6),
  "zero/point": reveal(15),
  "null/cmd": reveal(42.5),
  // Killjoy
  nanoswarm: circle(4.5),
  alarmbot: reveal(5.5),
  turret: cone(40, 100),
  lockdown: reveal(32.5),
  // Neon
  "fast lane": adjustable({ kind: "lane", length: 50, gap: 5, style: "wall" }, 8, 50),
  "relay bolt": circle(5),
  // Omen
  paranoia: rect(30, 4),
  "dark cover": smoke(4.1),
  // Phoenix
  blaze: wall(15, 1, "origin"),
  "hot hands": circle(4.5),
  // Raze
  "blast pack": circle(3),
  "paint shells": circle(6),
  showstopper: circle(7),
  // Sage
  "barrier orb": wall(10, 1.5, "center"),
  "slow orb": circle(7),
  // Skye
  regrowth: reveal(18),
  // Sova
  "shock bolt": circle(4),
  "recon bolt": reveal(30),
  "hunter's fury": rect(66, 3),
  // Tejo
  "guided salvo": circle(4),
  "special delivery": circle(5),
  armageddon: rect(30, 12),
  // Veto
  chokehold: circle(6),
  interceptor: reveal(8),
  // Viper
  "snake bite": circle(4.5),
  "poison cloud": smoke(4.5),
  "toxic screen": wall(50, 1, "origin"),
  "viper's pit": smoke(18),
  // Vyse
  razorvine: circle(4.5),
  shear: wall(6, 1, "center"),
  "steel garden": reveal(32),
  // Waylay
  saturate: circle(5),
  "convergent paths": rect(30, 10),
};

export const areaKey = (abilityName: string) => abilityName.toLowerCase().split(" / ")[0]!.trim();

/** The area spec for a placed ability, if the game has one we can draw. */
export function areaFor(agent: BoardAgent | undefined, slot: string): AreaSpec | null {
  const ab = agent?.abilities.find((a) => a.slot === slot);
  return ab ? (ABILITY_AREAS[areaKey(ab.name)] ?? null) : null;
}

export const isDirectional = (spec: AreaSpec) => spec.kind !== "circle";

/** Default when a map has no scale: board units per metre on a typical map. */
export const DEFAULT_SCALE = 6.7;

type Pt = [number, number];
export type AreaShape = {
  circles: { cx: number; cy: number; r: number }[];
  polys: Pt[][];
  style: AreaStyle;
  handle: Pt;
};

/** The in-game length or radius in metres that the handle controls. */
export function primaryMetres(spec: AreaSpec): number {
  switch (spec.kind) {
    case "circle":
      return spec.r;
    case "cone":
      return spec.range;
    default:
      return spec.length;
  }
}

/** The size multiplier actually drawn: 1 for fixed abilities, otherwise kept within the game's limits. */
export function effectiveReach(spec: AreaSpec, reach: number): number {
  if (!spec.adjust) return 1;
  const base = primaryMetres(spec);
  const metres = Math.min(spec.adjust[1], Math.max(spec.adjust[0], base * reach));
  return metres / base;
}

/** Length (board units) that "reach = 1" corresponds to, measured from the ability to its handle. */
export function baseReach(spec: AreaSpec, scale: number): number {
  switch (spec.kind) {
    case "circle":
      return spec.r * scale;
    case "cone":
      return spec.range * scale;
    case "wall":
      return (spec.from === "center" ? spec.length / 2 : spec.length) * scale;
    case "cross":
      return (spec.length / 2) * scale;
    default:
      return spec.length * scale;
  }
}

/** Polygons and circles for an ability's area, in board units around the ability's position. */
export function abilityArea(item: ItemOf<"ability">, spec: AreaSpec, scale: number): AreaShape {
  const { x, y } = item;
  const k = scale * effectiveReach(spec, item.reach);
  const rad = (item.dir * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const px = -uy;
  const py = ux;
  const band = (sx: number, sy: number, len: number, width: number): Pt[] => {
    const h = width / 2;
    const ex = sx + ux * len;
    const ey = sy + uy * len;
    return [
      [sx + px * h, sy + py * h],
      [ex + px * h, ey + py * h],
      [ex - px * h, ey - py * h],
      [sx - px * h, sy - py * h],
    ];
  };
  const thick = (m: number) => Math.max(5, m * scale);

  switch (spec.kind) {
    case "circle": {
      const r = spec.r * k;
      return { circles: [{ cx: x, cy: y, r }], polys: [], style: spec.style, handle: [x + ux * r, y + uy * r] };
    }
    case "wall": {
      const len = spec.length * k;
      const sx = spec.from === "center" ? x - (ux * len) / 2 : x;
      const sy = spec.from === "center" ? y - (uy * len) / 2 : y;
      return {
        circles: [],
        polys: [band(sx, sy, len, thick(spec.width))],
        style: spec.style,
        handle: [sx + ux * len, sy + uy * len],
      };
    }
    case "rect": {
      const len = spec.length * k;
      return {
        circles: [],
        polys: [band(x, y, len, Math.max(4, spec.width * scale))],
        style: spec.style,
        handle: [x + ux * len, y + uy * len],
      };
    }
    case "cone": {
      const r = spec.range * k;
      const half = (spec.angle * Math.PI) / 360;
      const pts: Pt[] = [[x, y]];
      for (let i = 0; i <= 16; i++) {
        const a = rad - half + (i * 2 * half) / 16;
        pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
      return { circles: [], polys: [pts], style: spec.style, handle: [x + ux * r, y + uy * r] };
    }
    case "lane": {
      const len = spec.length * k;
      const g = (spec.gap * scale) / 2;
      const w = thick(0.8);
      return {
        circles: [],
        polys: [band(x + px * g, y + py * g, len, w), band(x - px * g, y - py * g, len, w)],
        style: spec.style,
        handle: [x + ux * len, y + uy * len],
      };
    }
    case "cross": {
      const len = spec.length * k;
      const w = thick(1.2);
      const vx = -uy;
      const vy = ux;
      const a = band(x - (ux * len) / 2, y - (uy * len) / 2, len, w);
      // second arm, perpendicular
      const h = w / 2;
      const sx = x - (vx * len) / 2;
      const sy = y - (vy * len) / 2;
      const ex = x + (vx * len) / 2;
      const ey = y + (vy * len) / 2;
      const b: Pt[] = [
        [sx + ux * h, sy + uy * h],
        [ex + ux * h, ey + uy * h],
        [ex - ux * h, ey - uy * h],
        [sx - ux * h, sy - uy * h],
      ];
      return { circles: [], polys: [a, b], style: spec.style, handle: [x + (ux * len) / 2, y + (uy * len) / 2] };
    }
  }
}

/** Fill and stroke opacity per style, shared by the SVG and canvas renderers. */
export const AREA_PAINT: Record<AreaStyle, { fill: number; stroke: number; dash: boolean }> = {
  smoke: { fill: 0.38, stroke: 0.9, dash: false },
  zone: { fill: 0.18, stroke: 0.85, dash: false },
  wall: { fill: 0.65, stroke: 1, dash: false },
  reveal: { fill: 0.07, stroke: 0.8, dash: true },
};
