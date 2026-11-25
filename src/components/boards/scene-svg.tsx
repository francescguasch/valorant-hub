import type { DOMAttributes, PointerEvent as ReactPointerEvent, Ref } from "react";
import {
  arrowHead,
  ICON,
  itemBox,
  MARKER_PATHS,
  shaftEnd,
  SIZE,
  smoothPath,
  TEAM_COLOR,
  type BoardCatalog,
  type Item,
  type Scene,
} from "@/lib/boards/scene";
import { abilityArea, AREA_PAINT, areaFor, DEFAULT_SCALE } from "@/lib/boards/abilities";

/**
 * Draws a tactics board as SVG. Pure (no hooks), so server pages use it for the
 * read-only view and the editor passes pointer handlers and a selection.
 */
export const BOARD_FONT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
export const INK = "#0b0f14";

export type SceneSvgProps = {
  scene: Scene;
  catalog: BoardCatalog;
  mapId: string | null;
  /** Unique per page, so clip-path ids don't collide between boards. */
  uid: string;
  className?: string;
  title?: string;
  selectedId?: string | null;
  svgRef?: Ref<SVGSVGElement>;
  layerRef?: Ref<SVGGElement>;
  onItemPointerDown?: (e: ReactPointerEvent<SVGGElement>, item: Item) => void;
  /** Drag handle that aims and sizes the selected ability's area (editor only). */
  onHandlePointerDown?: (e: ReactPointerEvent<SVGCircleElement>, item: Item) => void;
  /** Drag handle that turns the selected item (editor only). */
  onRotatePointerDown?: (e: ReactPointerEvent<SVGGElement>, item: Item) => void;
  /** Pointer and drop handlers for the whole board (editor only). */
  boardHandlers?: Pick<
    DOMAttributes<SVGSVGElement>,
    "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onDragOver" | "onDrop"
  >;
  interactive?: boolean;
};

export function SceneSvg({
  scene,
  catalog,
  mapId,
  uid,
  className,
  title,
  selectedId,
  svgRef,
  layerRef,
  onItemPointerDown,
  onHandlePointerDown,
  onRotatePointerDown,
  boardHandlers,
  interactive,
}: SceneSvgProps) {
  const map = catalog.maps.find((m) => m.id === mapId) ?? null;
  const agentIcon = new Map(catalog.agents.map((a) => [a.name.toLowerCase(), a]));
  const rot = scene.rot;
  const scale = map?.scale ?? DEFAULT_SCALE;
  const clip = `${uid}-round`;
  const grid = `${uid}-grid`;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={className}
      role="img"
      aria-label={title ?? "Tactics board"}
      style={{ touchAction: interactive ? "none" : undefined, userSelect: "none" }}
      {...boardHandlers}
    >
      <defs>
        <clipPath id={clip} clipPathUnits="objectBoundingBox">
          <circle cx="0.5" cy="0.5" r="0.5" />
        </clipPath>
        <pattern id={grid} width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M50 0H0V50" fill="none" stroke="#ffffff" strokeOpacity="0.045" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect width={SIZE} height={SIZE} fill="#10161d" />
      <rect width={SIZE} height={SIZE} fill={`url(#${grid})`} pointerEvents="none" />
      <g ref={layerRef} transform={rot ? `rotate(${rot} ${SIZE / 2} ${SIZE / 2})` : undefined}>
        {scene.bg.kind === "map" && map?.minimap ? (
          <image href={map.minimap} x="20" y="20" width={SIZE - 40} height={SIZE - 40} pointerEvents="none" />
        ) : null}
        {scene.bg.kind === "map" && !map?.minimap ? (
          <text
            x={SIZE / 2}
            y={SIZE / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fillOpacity="0.12"
            fontFamily={BOARD_FONT}
            fontWeight="800"
            fontSize="120"
            transform={rot ? `rotate(${-rot} ${SIZE / 2} ${SIZE / 2})` : undefined}
            pointerEvents="none"
          >
            {(map?.name ?? "No map").toUpperCase()}
          </text>
        ) : null}
        {scene.bg.kind === "image" ? (
          <image
            href={scene.bg.url}
            x="0"
            y="0"
            width={SIZE}
            height={SIZE}
            preserveAspectRatio="xMidYMid meet"
            pointerEvents="none"
          />
        ) : null}
        {scene.bg.kind === "map" && scene.callouts && map?.minimap
          ? map.callouts.map((c) => (
              <text
                key={`${c.label}-${c.x}-${c.y}`}
                x={calloutX(c.x)}
                y={calloutY(c.y)}
                transform={rot ? `rotate(${-rot} ${calloutX(c.x)} ${calloutY(c.y)})` : undefined}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={BOARD_FONT}
                fontWeight="600"
                fontSize="17"
                letterSpacing="0.3"
                fill="#ffffff"
                fillOpacity="0.78"
                stroke={INK}
                strokeOpacity="0.45"
                strokeWidth="2.5"
                paintOrder="stroke"
                pointerEvents="none"
              >
                {c.label}
              </text>
            ))
          : null}
        {scene.items.map((item) => (
          <g
            key={item.id}
            data-item={item.id}
            onPointerDown={onItemPointerDown ? (e) => onItemPointerDown(e, item) : undefined}
            style={interactive ? { cursor: "pointer" } : undefined}
          >
            <ItemShape item={item} rot={rot} clip={clip} icon={agentIcon} scale={scale} />
            {selectedId === item.id ? <Selection item={item} rot={rot} /> : null}
            {selectedId === item.id && onHandlePointerDown ? (
              <AreaHandle item={item} icon={agentIcon} scale={scale} onPointerDown={onHandlePointerDown} />
            ) : null}
            {selectedId === item.id && onRotatePointerDown ? (
              <RotateHandle item={item} rot={rot} icon={agentIcon} onPointerDown={onRotatePointerDown} />
            ) : null}
          </g>
        ))}
      </g>
    </svg>
  );
}

// The minimap is drawn inset by 20 units on each side; callouts follow it.
export const calloutX = (x: number) => 20 + (x * (SIZE - 40)) / SIZE;
export const calloutY = (y: number) => 20 + (y * (SIZE - 40)) / SIZE;

/** Icons stay upright when the board turns, then take their own angle (r). */
const upright = (x: number, y: number, rot: number, s = 1, r = 0) =>
  `translate(${x} ${y})${r - rot ? ` rotate(${r - rot})` : ""}${s !== 1 ? ` scale(${s})` : ""}`;

/** Dark text on light fills, light text on dark ones. */
export function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum > 150 ? INK : "#ffffff";
}

function ItemShape({
  item,
  rot,
  clip,
  icon,
  scale,
}: {
  item: Item;
  rot: number;
  clip: string;
  icon: Map<string, BoardCatalog["agents"][number]>;
  scale: number;
}) {
  switch (item.t) {
    case "circle":
      return (
        <circle
          cx={item.x}
          cy={item.y}
          r={item.r}
          fill={item.color}
          fillOpacity="0.2"
          stroke={item.color}
          strokeWidth="3"
        />
      );
    case "rect":
      return (
        <rect
          x={item.x}
          y={item.y}
          width={item.w}
          height={item.h}
          fill={item.color}
          fillOpacity="0.2"
          stroke={item.color}
          strokeWidth="3"
          transform={item.r ? `rotate(${item.r} ${item.x + item.w / 2} ${item.y + item.h / 2})` : undefined}
        />
      );
    case "pen": {
      const d = smoothPath(item.pts);
      return (
        <>
          <path d={d} fill="none" stroke="transparent" strokeWidth={item.w + 16} strokeLinecap="round" />
          <path
            d={d}
            fill="none"
            stroke={item.color}
            strokeWidth={item.w}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={item.dash ? `${item.w * 2.2} ${item.w * 2}` : undefined}
          />
        </>
      );
    }
    case "arrow": {
      const [ex, ey] = item.head ? shaftEnd(item.x1, item.y1, item.x2, item.y2, item.w) : [item.x2, item.y2];
      const head = arrowHead(item.x1, item.y1, item.x2, item.y2, item.w);
      return (
        <>
          <line x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} stroke="transparent" strokeWidth={item.w + 16} />
          <line
            x1={item.x1}
            y1={item.y1}
            x2={ex}
            y2={ey}
            stroke={item.color}
            strokeWidth={item.w}
            strokeLinecap="round"
            strokeDasharray={item.dash ? `${item.w * 2.2} ${item.w * 2}` : undefined}
          />
          {item.head ? <polygon points={head.map((p) => p.join(",")).join(" ")} fill={item.color} /> : null}
        </>
      );
    }
    case "agent": {
      const a = icon.get(item.agent.toLowerCase());
      const r = ICON.agent / 2;
      return (
        <g transform={upright(item.x, item.y, rot, item.s, item.r)}>
          <circle r={r} fill={INK} stroke={TEAM_COLOR[item.team]} strokeWidth="4" />
          {a?.icon ? (
            <image
              href={a.icon}
              x={-r + 4}
              y={-r + 4}
              width={(r - 4) * 2}
              height={(r - 4) * 2}
              clipPath={`url(#${clip})`}
            />
          ) : (
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily={BOARD_FONT}
              fontWeight="700"
              fontSize="22"
              fill="#ffffff"
            >
              {item.agent.slice(0, 2).toUpperCase()}
            </text>
          )}
        </g>
      );
    }
    case "ability": {
      const a = icon.get(item.agent.toLowerCase());
      const ab = a?.abilities.find((x) => x.slot === item.slot);
      const spec = item.area ? areaFor(a, item.slot) : null;
      const h = ICON.ability / 2;
      const color = TEAM_COLOR[item.team];
      let area = null;
      if (spec) {
        const shape = abilityArea(item, spec, scale);
        const paint = AREA_PAINT[shape.style];
        const common = {
          fill: color,
          fillOpacity: paint.fill,
          stroke: color,
          strokeOpacity: paint.stroke,
          strokeWidth: 2.5,
          strokeDasharray: paint.dash ? "9 7" : undefined,
          strokeLinejoin: "round" as const,
        };
        area = (
          <>
            {shape.circles.map((c, i) => (
              <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} {...common} />
            ))}
            {shape.polys.map((p, i) => (
              <polygon key={`p${i}`} points={p.map((q) => q.join(",")).join(" ")} {...common} />
            ))}
          </>
        );
      }
      return (
        <>
          {area}
          <g transform={upright(item.x, item.y, rot, item.s, item.r)}>
            <rect x={-h} y={-h} width={h * 2} height={h * 2} rx="9" fill={INK} stroke={color} strokeWidth="3.5" />
            {ab?.icon ? (
              <image href={ab.icon} x={-h + 7} y={-h + 7} width={(h - 7) * 2} height={(h - 7) * 2} />
            ) : (
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={BOARD_FONT}
                fontWeight="700"
                fontSize="16"
                fill="#fff"
              >
                {item.agent.slice(0, 1)}
                {slotKey(item.slot)}
              </text>
            )}
          </g>
        </>
      );
    }
    case "marker": {
      const r = ICON.marker / 2;
      return (
        <g transform={upright(item.x, item.y, rot, item.s, item.r)}>
          <circle r={r} fill={INK} fillOpacity="0.85" stroke={item.color} strokeWidth="3" />
          <path
            d={MARKER_PATHS[item.kind]}
            transform="translate(-13 -13) scale(1.0833)"
            fill="none"
            stroke={item.color}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    }
    case "step":
      return (
        <g transform={upright(item.x, item.y, rot, item.s, item.r)}>
          <circle r={ICON.step / 2} fill={item.color} stroke={INK} strokeWidth="2.5" />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={BOARD_FONT}
            fontWeight="800"
            fontSize="23"
            fill={inkOn(item.color)}
          >
            {item.n}
          </text>
        </g>
      );
    case "text":
      return (
        <g transform={upright(item.x, item.y, rot, item.s, item.r)}>
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={BOARD_FONT}
            fontWeight="700"
            fontSize={ICON.text}
            fill={item.color}
            stroke={INK}
            strokeWidth="6"
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {item.text || " "}
          </text>
        </g>
      );
  }
}

function AreaHandle({
  item,
  icon,
  scale,
  onPointerDown,
}: {
  item: Item;
  icon: Map<string, BoardCatalog["agents"][number]>;
  scale: number;
  onPointerDown: (e: ReactPointerEvent<SVGCircleElement>, item: Item) => void;
}) {
  if (item.t !== "ability" || !item.area) return null;
  const spec = areaFor(icon.get(item.agent.toLowerCase()), item.slot);
  if (!spec) return null;
  const [hx, hy] = abilityArea(item, spec, scale).handle;
  return (
    <g>
      <line
        x1={item.x}
        y1={item.y}
        x2={hx}
        y2={hy}
        stroke="#ffffff"
        strokeOpacity="0.6"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        pointerEvents="none"
      />
      <circle
        cx={hx}
        cy={hy}
        r="11"
        fill="#ffffff"
        stroke={INK}
        strokeWidth="3"
        style={{ cursor: "grab" }}
        data-handle={item.id}
        onPointerDown={(e) => onPointerDown(e, item)}
      />
    </g>
  );
}

/** A round handle above the selection: drag it around to turn the item. */
function RotateHandle({
  item,
  rot,
  icon,
  onPointerDown,
}: {
  item: Item;
  rot: number;
  icon: Map<string, BoardCatalog["agents"][number]>;
  onPointerDown: (e: ReactPointerEvent<SVGGElement>, item: Item) => void;
}) {
  if (item.t === "circle") return null;
  // Abilities with a wall, cone or line are aimed with their own handle instead.
  if (item.t === "ability" && item.area) {
    const spec = areaFor(icon.get(item.agent.toLowerCase()), item.slot);
    if (spec && spec.kind !== "circle") return null;
  }
  const b = itemBox(item);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const t = (rot * Math.PI) / 180;
  // "Up" on screen, whatever way the board is turned.
  const ux = -Math.sin(t);
  const uy = -Math.cos(t);
  const d = Math.max(b.w, b.h) / 2 + 34;
  const hx = cx + ux * d;
  const hy = cy + uy * d;
  return (
    <g data-rotate={item.id} style={{ cursor: "grab" }} onPointerDown={(e) => onPointerDown(e, item)}>
      <line
        x1={cx + ux * (d - 22)}
        y1={cy + uy * (d - 22)}
        x2={hx}
        y2={hy}
        stroke="#ffffff"
        strokeOpacity="0.6"
        strokeWidth="1.5"
        pointerEvents="none"
      />
      <circle cx={hx} cy={hy} r="13" fill="#ffffff" stroke={INK} strokeWidth="3" />
      <path
        d="M-5 -1.5 A5.5 5.5 0 1 1 -1.5 4.8 M-5 -1.5 L-6.2 -6 M-5 -1.5 L-0.6 -2.6"
        transform={`translate(${hx} ${hy}) rotate(${-rot})`}
        fill="none"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
        pointerEvents="none"
      />
    </g>
  );
}

export const slotKey = (slot: string) => ({ Grenade: "C", Ability1: "Q", Ability2: "E", Ultimate: "X" })[slot] ?? "";

function Selection({ item, rot }: { item: Item; rot: number }) {
  const b = itemBox(item);
  const pad = 8;
  const isUpright =
    item.t === "agent" || item.t === "ability" || item.t === "marker" || item.t === "step" || item.t === "text";
  const rect = (
    <rect
      x={isUpright ? -b.w / 2 - pad : b.x - pad}
      y={isUpright ? -b.h / 2 - pad : b.y - pad}
      width={b.w + pad * 2}
      height={b.h + pad * 2}
      fill="none"
      stroke="#ffffff"
      strokeWidth="2"
      strokeDasharray="7 6"
      pointerEvents="none"
    />
  );
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (!isUpright) {
    return item.t === "rect" && item.r ? <g transform={`rotate(${item.r} ${cx} ${cy})`}>{rect}</g> : rect;
  }
  return <g transform={upright(cx, cy, rot, 1, "r" in item ? item.r : 0)}>{rect}</g>;
}
