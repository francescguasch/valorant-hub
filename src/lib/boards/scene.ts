import { z } from "zod";

/**
 * A tactics board is a list of items drawn over a map, in a square
 * 1000 × 1000 space that matches the map's minimap. The same data drives the
 * editor (SVG), the read-only view and the image export (canvas).
 */
export const SIZE = 1000;
export const MAX_ITEMS = 600;
export const MAX_PEN_POINTS = 2000;

export const COLORS = [
  { value: "#ff4655", label: "Red" },
  { value: "#2fd3b4", label: "Teal" },
  { value: "#ffd166", label: "Yellow" },
  { value: "#f2f4f7", label: "White" },
  { value: "#6aa9ff", label: "Blue" },
  { value: "#c58cff", label: "Purple" },
] as const;

export const TEAM_COLOR = { ally: "#2fd3b4", enemy: "#ff4655" } as const;
export type Team = keyof typeof TEAM_COLOR;

export const MARKERS = ["spike", "cross", "eye", "danger"] as const;
export type MarkerKind = (typeof MARKERS)[number];

const num = z.number().finite();
const coord = num.min(-SIZE).max(SIZE * 2);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const scale = num.min(0.4).max(3).default(1);
/** Rotation in degrees, clockwise. */
const angle = num.min(-720).max(720).default(0);
const id = z.string().min(1).max(40);
const team = z.enum(["ally", "enemy"]);
const name = z.string().trim().min(1).max(40);

const agentItem = z.object({ id, t: z.literal("agent"), agent: name, x: coord, y: coord, team, s: scale, r: angle });
const abilityItem = z.object({
  id,
  t: z.literal("ability"),
  agent: name,
  slot: z.string().max(20),
  x: coord,
  y: coord,
  team,
  s: scale,
  r: angle,
  /** Draw the ability's area (smoke, wall, cone…) under the icon. */
  area: z.boolean().default(true),
  /** Direction of walls, cones and lines, in degrees (0 = right, clockwise). */
  dir: num.min(-720).max(720).default(0),
  /** Area size relative to the in-game size. */
  reach: num.min(0.2).max(4).default(1),
});
const markerItem = z.object({
  id,
  t: z.literal("marker"),
  kind: z.enum(MARKERS),
  x: coord,
  y: coord,
  color,
  s: scale,
  r: angle,
});
const stepItem = z.object({
  id,
  t: z.literal("step"),
  n: z.number().int().min(1).max(99),
  x: coord,
  y: coord,
  color,
  s: scale,
  r: angle,
});
const penItem = z.object({
  id,
  t: z.literal("pen"),
  pts: z
    .array(coord)
    .min(2)
    .max(MAX_PEN_POINTS * 2),
  color,
  w: num.min(1).max(30),
  dash: z.boolean().default(false),
});
const arrowItem = z.object({
  id,
  t: z.literal("arrow"),
  x1: coord,
  y1: coord,
  x2: coord,
  y2: coord,
  color,
  w: num.min(1).max(30),
  dash: z.boolean().default(false),
  head: z.boolean().default(true),
});
const circleItem = z.object({ id, t: z.literal("circle"), x: coord, y: coord, r: num.min(2).max(SIZE), color });
const rectItem = z.object({
  id,
  t: z.literal("rect"),
  x: coord,
  y: coord,
  w: num.min(2).max(SIZE * 2),
  h: num.min(2).max(SIZE * 2),
  color,
  r: angle,
});
const textItem = z.object({
  id,
  t: z.literal("text"),
  x: coord,
  y: coord,
  text: z.string().max(200),
  color,
  s: scale,
  r: angle,
});

export const itemSchema = z.discriminatedUnion("t", [
  agentItem,
  abilityItem,
  markerItem,
  stepItem,
  penItem,
  arrowItem,
  circleItem,
  rectItem,
  textItem,
]);
export type Item = z.infer<typeof itemSchema>;
export type ItemOf<T extends Item["t"]> = Extract<Item, { t: T }>;

export const backgroundSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("map") }),
  z.object({ kind: z.literal("blank") }),
  z.object({
    kind: z.literal("image"),
    url: z
      .string()
      .regex(/^https?:\/\//)
      .max(2000),
  }),
]);
export type Background = z.infer<typeof backgroundSchema>;

export const sceneSchema = z.object({
  v: z.literal(1).default(1),
  bg: backgroundSchema.default({ kind: "map" }),
  rot: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  callouts: z.boolean().default(true),
  items: z.array(itemSchema).max(MAX_ITEMS).default([]),
});
export type Scene = z.infer<typeof sceneSchema>;

export const emptyScene = (): Scene => ({ v: 1, bg: { kind: "map" }, rot: 0, callouts: true, items: [] });

/** Reads stored or posted scene data; anything malformed becomes an empty board rather than an error page. */
export function parseScene(raw: unknown): Scene {
  const parsed = sceneSchema.safeParse(raw);
  return parsed.success ? parsed.data : emptyScene();
}

/** What the editor needs to draw a board: map minimaps with callouts, agents with their abilities. */
export type BoardMap = {
  id: string;
  name: string;
  minimap: string | null;
  callouts: { label: string; x: number; y: number }[];
  /** Board units per in-game metre, from the minimap's scale. */
  scale: number | null;
};
export type BoardAgent = {
  name: string;
  role: string;
  icon: string | null;
  abilities: { slot: string; name: string; icon: string | null }[];
};
export type BoardCatalog = { maps: BoardMap[]; agents: BoardAgent[] };

// -----------------------------------------------------------------------------
// Geometry shared by the SVG renderer and the canvas export
// -----------------------------------------------------------------------------

/** Base sizes (board units) before an item's own scale. */
export const ICON = { agent: 54, ability: 42, marker: 44, step: 38, text: 30 } as const;

/** The three points of an arrowhead at (x2, y2). */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, w: number): [number, number][] {
  const len = Math.max(14, w * 4.2);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const spread = Math.PI / 7;
  return [
    [x2, y2],
    [x2 - len * Math.cos(a - spread), y2 - len * Math.sin(a - spread)],
    [x2 - len * Math.cos(a + spread), y2 - len * Math.sin(a + spread)],
  ];
}

/** Where an arrow's shaft stops so the line doesn't poke through the head. */
export function shaftEnd(x1: number, y1: number, x2: number, y2: number, w: number): [number, number] {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return [x2, y2];
  const back = Math.min(len, Math.max(14, w * 4.2) * 0.8);
  return [x2 - ((x2 - x1) / len) * back, y2 - ((y2 - y1) / len) * back];
}

/** A smooth SVG path through freehand points (quadratic curves through midpoints). */
export function smoothPath(pts: number[]): string {
  if (pts.length < 4) return pts.length === 2 ? `M${pts[0]} ${pts[1]}l0.01 0` : "";
  let d = `M${pts[0]} ${pts[1]}`;
  for (let i = 2; i < pts.length - 2; i += 2) {
    const mx = (pts[i]! + pts[i + 2]!) / 2;
    const my = (pts[i + 1]! + pts[i + 3]!) / 2;
    d += `Q${pts[i]} ${pts[i + 1]} ${round1(mx)} ${round1(my)}`;
  }
  d += `L${pts[pts.length - 2]} ${pts[pts.length - 1]}`;
  return d;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Ramer–Douglas–Peucker: drops points that don't change the stroke's shape. */
export function simplify(pts: number[], tolerance = 1.5): number[] {
  const n = pts.length / 2;
  if (n <= 2) return pts.map(Math.round);
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = pts[a * 2]!,
      ay = pts[a * 2 + 1]!,
      bx = pts[b * 2]!,
      by = pts[b * 2 + 1]!;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let far = -1;
    let dist = tolerance;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i * 2]!,
        py = pts[i * 2 + 1]!;
      const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (d > dist) {
        dist = d;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(Math.round(pts[i * 2]!), Math.round(pts[i * 2 + 1]!));
  return out;
}

/** Moves an item by (dx, dy). */
export function moveItem(item: Item, dx: number, dy: number): Item {
  switch (item.t) {
    case "pen":
      return { ...item, pts: item.pts.map((v, i) => Math.round(v + (i % 2 ? dy : dx))) };
    case "arrow":
      return { ...item, x1: item.x1 + dx, y1: item.y1 + dy, x2: item.x2 + dx, y2: item.y2 + dy };
    default:
      return { ...item, x: item.x + dx, y: item.y + dy };
  }
}

/** Turns lines and freehand strokes around their centre (other items keep an angle instead). */
export function rotateGeometry(item: Item, deg: number): Item {
  if (item.t !== "pen" && item.t !== "arrow") return item;
  const b = itemBox(item);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const turn = (x: number, y: number): [number, number] => [
    Math.round((cx + (x - cx) * cos - (y - cy) * sin) * 10) / 10,
    Math.round((cy + (x - cx) * sin + (y - cy) * cos) * 10) / 10,
  ];
  if (item.t === "arrow") {
    const [x1, y1] = turn(item.x1, item.y1);
    const [x2, y2] = turn(item.x2, item.y2);
    return { ...item, x1, y1, x2, y2 };
  }
  const pts: number[] = [];
  for (let i = 0; i < item.pts.length; i += 2) pts.push(...turn(item.pts[i]!, item.pts[i + 1]!));
  return { ...item, pts };
}

export const normalizeAngle = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/** Axis-aligned box around an item, in board units (unrotated map space). */
export function itemBox(item: Item): { x: number; y: number; w: number; h: number } {
  const square = (cx: number, cy: number, size: number) => ({ x: cx - size / 2, y: cy - size / 2, w: size, h: size });
  switch (item.t) {
    case "agent":
      return square(item.x, item.y, ICON.agent * item.s);
    case "ability":
      return square(item.x, item.y, ICON.ability * item.s);
    case "marker":
      return square(item.x, item.y, ICON.marker * item.s);
    case "step":
      return square(item.x, item.y, ICON.step * item.s);
    case "text": {
      const size = ICON.text * item.s;
      const w = Math.max(size, item.text.length * size * 0.52);
      return { x: item.x - w / 2, y: item.y - size / 2, w, h: size };
    }
    case "circle":
      return square(item.x, item.y, item.r * 2);
    case "rect":
      return { x: item.x, y: item.y, w: item.w, h: item.h };
    case "arrow": {
      const x = Math.min(item.x1, item.x2),
        y = Math.min(item.y1, item.y2);
      return { x, y, w: Math.abs(item.x2 - item.x1), h: Math.abs(item.y2 - item.y1) };
    }
    case "pen": {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (let i = 0; i < item.pts.length; i += 2) {
        minX = Math.min(minX, item.pts[i]!);
        maxX = Math.max(maxX, item.pts[i]!);
        minY = Math.min(minY, item.pts[i + 1]!);
        maxY = Math.max(maxY, item.pts[i + 1]!);
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
  }
}

/** Icon outlines for markers, drawn in a 24 × 24 box (lucide-style strokes). */
export const MARKER_PATHS: Record<MarkerKind, string> = {
  spike: "M12 2 L19 7 L19 17 L12 22 L5 17 L5 7 Z M12 7 L12 13 M12 16.5 L12 17",
  cross: "M6 6 L18 18 M18 6 L6 18",
  eye: "M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z M12 9.2 A2.8 2.8 0 1 0 12.01 9.2 Z",
  danger: "M12 3 L22 20 L2 20 Z M12 9 L12 14 M12 17 L12 17.2",
};

export const MARKER_LABEL: Record<MarkerKind, string> = {
  spike: "Spike",
  cross: "Mark",
  eye: "Watch",
  danger: "Danger",
};

/** Short label for a callout from valorant-api's region names. */
export function calloutLabel(superRegion: string, region: string): string {
  if (!superRegion || superRegion === region) return region;
  return `${superRegion} ${region}`;
}

export const newId = () => Math.random().toString(36).slice(2, 10);
