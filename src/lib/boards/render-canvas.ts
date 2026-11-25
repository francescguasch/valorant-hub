import {
  arrowHead,
  ICON,
  MARKER_PATHS,
  shaftEnd,
  SIZE,
  smoothPath,
  TEAM_COLOR,
  type BoardCatalog,
  type Scene,
} from "./scene";
import { abilityArea, AREA_PAINT, areaFor, DEFAULT_SCALE } from "./abilities";

/**
 * Paints a board on a canvas, mirroring components/boards/scene-svg.tsx, so it
 * can be saved and downloaded as an image. Images come from hosts that allow
 * cross-origin use (valorant-api.com, Supabase Storage); one that doesn't is
 * skipped instead of breaking the export.
 */
const FONT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
const INK = "#0b0f14";

const cache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(url: string): Promise<HTMLImageElement | null> {
  let p = cache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    cache.set(url, p);
  }
  return p;
}

export async function renderBoard(
  scene: Scene,
  catalog: BoardCatalog,
  mapId: string | null,
  px = 1400,
): Promise<HTMLCanvasElement> {
  const map = catalog.maps.find((m) => m.id === mapId) ?? null;
  const agents = new Map(catalog.agents.map((a) => [a.name.toLowerCase(), a]));

  // Load every picture first.
  const urls = new Set<string>();
  if (scene.bg.kind === "map" && map?.minimap) urls.add(map.minimap);
  if (scene.bg.kind === "image") urls.add(scene.bg.url);
  for (const it of scene.items) {
    const a = it.t === "agent" || it.t === "ability" ? agents.get(it.agent.toLowerCase()) : undefined;
    if (it.t === "agent" && a?.icon) urls.add(a.icon);
    if (it.t === "ability") {
      const ab = a?.abilities.find((x) => x.slot === it.slot);
      if (ab?.icon) urls.add(ab.icon);
    }
  }
  const images = new Map<string, HTMLImageElement | null>();
  await Promise.all([...urls].map(async (u) => images.set(u, await loadImage(u))));
  if (typeof document !== "undefined" && document.fonts) await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(px / SIZE, px / SIZE);
  ctx.fillStyle = "#10161d";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1.5;
  for (let i = 50; i < SIZE; i += 50) {
    line(ctx, i, 0, i, SIZE);
    line(ctx, 0, i, SIZE, i);
  }

  const rot = (scene.rot * Math.PI) / 180;
  const scale = map?.scale ?? DEFAULT_SCALE;
  ctx.save();
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.rotate(rot);
  ctx.translate(-SIZE / 2, -SIZE / 2);

  const draw = (url: string | null | undefined, x: number, y: number, w: number, h: number) => {
    const img = url ? images.get(url) : null;
    if (img) ctx.drawImage(img, x, y, w, h);
    return Boolean(img);
  };
  const upright = (x: number, y: number, s: number, fn: () => void) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-rot);
    ctx.scale(s, s);
    fn();
    ctx.restore();
  };
  const label = (
    text: string,
    size: number,
    weight: number,
    fill: string,
    stroke?: { color: string; width: number },
  ) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (stroke) {
      ctx.lineJoin = "round";
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.strokeText(text, 0, 0);
    }
    ctx.fillStyle = fill;
    ctx.fillText(text, 0, 0);
  };

  if (scene.bg.kind === "map") {
    if (!draw(map?.minimap, 20, 20, SIZE - 40, SIZE - 40)) {
      upright(SIZE / 2, SIZE / 2, 1, () =>
        label((map?.name ?? "No map").toUpperCase(), 120, 800, "rgba(255,255,255,0.12)"),
      );
    } else if (scene.callouts && map) {
      for (const c of map.callouts) {
        upright(20 + (c.x * (SIZE - 40)) / SIZE, 20 + (c.y * (SIZE - 40)) / SIZE, 1, () =>
          label(c.label, 17, 600, "rgba(255,255,255,0.78)", { color: "rgba(11,15,20,0.45)", width: 2.5 }),
        );
      }
    }
  } else if (scene.bg.kind === "image") {
    const img = images.get(scene.bg.url);
    if (img) {
      const k = Math.min(SIZE / img.naturalWidth, SIZE / img.naturalHeight);
      const w = img.naturalWidth * k;
      const h = img.naturalHeight * k;
      ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
    }
  }

  for (const it of scene.items) {
    switch (it.t) {
      case "circle":
        ctx.beginPath();
        ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2);
        zone(ctx, it.color);
        break;
      case "rect":
        ctx.beginPath();
        ctx.rect(it.x, it.y, it.w, it.h);
        zone(ctx, it.color);
        break;
      case "pen":
        ctx.save();
        ctx.strokeStyle = it.color;
        ctx.lineWidth = it.w;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (it.dash) ctx.setLineDash([it.w * 2.2, it.w * 2]);
        ctx.stroke(new Path2D(smoothPath(it.pts)));
        ctx.restore();
        break;
      case "arrow": {
        const [ex, ey] = it.head ? shaftEnd(it.x1, it.y1, it.x2, it.y2, it.w) : [it.x2, it.y2];
        ctx.save();
        ctx.strokeStyle = it.color;
        ctx.lineWidth = it.w;
        ctx.lineCap = "round";
        if (it.dash) ctx.setLineDash([it.w * 2.2, it.w * 2]);
        line(ctx, it.x1, it.y1, ex, ey);
        ctx.restore();
        if (it.head) {
          const [a, b, c] = arrowHead(it.x1, it.y1, it.x2, it.y2, it.w);
          ctx.beginPath();
          ctx.moveTo(...a!);
          ctx.lineTo(...b!);
          ctx.lineTo(...c!);
          ctx.closePath();
          ctx.fillStyle = it.color;
          ctx.fill();
        }
        break;
      }
      case "agent": {
        const a = agents.get(it.agent.toLowerCase());
        const r = ICON.agent / 2;
        upright(it.x, it.y, it.s, () => {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = INK;
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = TEAM_COLOR[it.team];
          ctx.stroke();
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
          ctx.clip();
          if (!draw(a?.icon, -r + 4, -r + 4, (r - 4) * 2, (r - 4) * 2))
            label(it.agent.slice(0, 2).toUpperCase(), 22, 700, "#fff");
          ctx.restore();
        });
        break;
      }
      case "ability": {
        const a = agents.get(it.agent.toLowerCase());
        const ab = a?.abilities.find((x) => x.slot === it.slot);
        const h = ICON.ability / 2;
        const spec = it.area ? areaFor(a, it.slot) : null;
        if (spec) {
          const shape = abilityArea(it, spec, scale);
          const paint = AREA_PAINT[shape.style];
          const color = TEAM_COLOR[it.team];
          const paths: Path2D[] = [];
          for (const c of shape.circles) {
            const p = new Path2D();
            p.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
            paths.push(p);
          }
          for (const poly of shape.polys) {
            const p = new Path2D();
            poly.forEach(([px, py], i) => (i ? p.lineTo(px, py) : p.moveTo(px, py)));
            p.closePath();
            paths.push(p);
          }
          ctx.save();
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.lineJoin = "round";
          if (paint.dash) ctx.setLineDash([9, 7]);
          for (const p of paths) {
            ctx.globalAlpha = paint.fill;
            ctx.fill(p);
            ctx.globalAlpha = paint.stroke;
            ctx.stroke(p);
          }
          ctx.restore();
        }
        upright(it.x, it.y, it.s, () => {
          ctx.beginPath();
          ctx.roundRect(-h, -h, h * 2, h * 2, 9);
          ctx.fillStyle = INK;
          ctx.fill();
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = TEAM_COLOR[it.team];
          ctx.stroke();
          if (!draw(ab?.icon, -h + 7, -h + 7, (h - 7) * 2, (h - 7) * 2)) label(it.agent.slice(0, 1), 16, 700, "#fff");
        });
        break;
      }
      case "marker":
        upright(it.x, it.y, it.s, () => {
          ctx.beginPath();
          ctx.arc(0, 0, ICON.marker / 2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(11,15,20,0.85)";
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = it.color;
          ctx.stroke();
          ctx.translate(-13, -13);
          ctx.scale(1.0833, 1.0833);
          ctx.lineWidth = 2.4;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.stroke(new Path2D(MARKER_PATHS[it.kind]));
        });
        break;
      case "step":
        upright(it.x, it.y, it.s, () => {
          ctx.beginPath();
          ctx.arc(0, 0, ICON.step / 2, 0, Math.PI * 2);
          ctx.fillStyle = it.color;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = INK;
          ctx.stroke();
          label(String(it.n), 23, 800, inkOn(it.color));
        });
        break;
      case "text":
        if (it.text)
          upright(it.x, it.y, it.s, () => label(it.text, ICON.text, 700, it.color, { color: INK, width: 6 }));
        break;
    }
  }
  ctx.restore();
  return canvas;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function zone(ctx: CanvasRenderingContext2D, color: string) {
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum > 150 ? INK : "#ffffff";
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/webp" | "image/png",
  quality = 0.9,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b && b.type === type ? b : null), type, quality);
    } catch {
      resolve(null); // a picture without cross-origin permission tainted the canvas
    }
  });
}
