"use client";

import { useState } from "react";
import { RADAR_AXES, type RadarKey } from "@/lib/stats/player";

export type RadarSeries = { label: string; color: string; values: Record<RadarKey, number | null> };

const W = 440;
const H = 400;
const CX = W / 2;
const CY = 190;
const R = 130;
// ACS on top, then clockwise: K/D right, kills per round bottom, win rate left.
const ANGLES = [-90, 0, 90, 180];

const at = (i: number, ratio: number): [number, number] => {
  const a = (ANGLES[i]! * Math.PI) / 180;
  return [CX + Math.cos(a) * R * ratio, CY + Math.sin(a) * R * ratio];
};

/**
 * Head-to-head radar for two picks. Each axis has a fixed scale (see
 * RADAR_AXES), so shapes compare across players and maps. Hover an axis for
 * the exact values; the stat tiles beside it carry the same numbers.
 */
export function RadarChart({ series }: { series: RadarSeries[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = series.filter((s) => RADAR_AXES.some((a) => s.values[a.key] !== null));
  const ratio = (s: RadarSeries, i: number) => {
    const ax = RADAR_AXES[i]!;
    const v = s.values[ax.key];
    return v === null ? 0 : Math.max(0, Math.min(1, v / ax.max));
  };
  const summary = shown
    .map((s) => `${s.label}: ${RADAR_AXES.map((a) => `${a.label} ${s.values[a.key] === null ? "none" : a.format(s.values[a.key]!)}`).join(", ")}`)
    .join(". ");

  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Head to head. ${summary}`}>
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <polygon
            key={r}
            points={ANGLES.map((_, i) => at(i, r).join(",")).join(" ")}
            fill="none"
            stroke="var(--color-line-strong)"
            strokeOpacity={r === 1 ? 0.9 : 0.5}
            strokeWidth="1"
          />
        ))}
        {ANGLES.map((_, i) => {
          const [x, y] = at(i, 1);
          return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--color-line-strong)" strokeOpacity="0.5" />;
        })}
        {shown.map((s) => (
          <polygon
            key={s.label}
            points={RADAR_AXES.map((_, i) => at(i, ratio(s, i)).join(",")).join(" ")}
            fill={s.color}
            fillOpacity="0.2"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ))}
        {shown.map((s) =>
          RADAR_AXES.map((ax, i) => {
            const [x, y] = at(i, ratio(s, i));
            return (
              <circle
                key={`${s.label}-${ax.key}`}
                cx={x}
                cy={y}
                r={hover === i ? 6 : 4.5}
                fill={s.color}
                stroke="var(--color-panel)"
                strokeWidth="2"
              />
            );
          }),
        )}
        {RADAR_AXES.map((ax, i) => {
          const [x, y] = at(i, 1);
          const dx = i === 1 ? 14 : i === 3 ? -14 : 0;
          const dy = i === 0 ? -16 : i === 2 ? 24 : 5;
          return (
            <text
              key={ax.key}
              x={x + dx}
              y={y + dy}
              textAnchor={i === 1 ? "start" : i === 3 ? "end" : "middle"}
              fill={hover === i ? "var(--color-bone)" : "var(--color-fog)"}
              fontSize="13.5"
              fontWeight="600"
              fontFamily="var(--font-display)"
              style={{ letterSpacing: "0.02em" }}
            >
              {ax.label}
            </text>
          );
        })}
        {/* Hit areas: the whole spoke and its label */}
        {RADAR_AXES.map((ax, i) => {
          const [x, y] = at(i, 1.12);
          return (
            <g key={`hit-${ax.key}`} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <line x1={CX} y1={CY} x2={x} y2={y} stroke="transparent" strokeWidth="34" />
              <circle cx={x} cy={y} r="30" fill="transparent" />
            </g>
          );
        })}
      </svg>

      {hover !== null && shown.length ? (
        <div
          className="pointer-events-none absolute z-10 min-w-[170px] border border-line-strong bg-raised px-3 py-2 text-[13px] shadow-lg"
          style={{
            left: `${(at(hover, 0.55)[0] / W) * 100}%`,
            top: `${(at(hover, 0.55)[1] / H) * 100}%`,
            transform: `translate(${hover === 3 ? "0" : hover === 1 ? "-100%" : "-50%"}, ${hover === 2 ? "-110%" : "10%"})`,
          }}
        >
          <p className="mb-1 font-semibold text-bone">{RADAR_AXES[hover]!.label}</p>
          {shown.map((s) => {
            const v = s.values[RADAR_AXES[hover]!.key];
            return (
              <p key={s.label} className="flex items-center gap-2 text-fog">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="flex-1 truncate">{s.label}</span>
                <span className="num text-[15px] text-bone">{v === null ? "—" : RADAR_AXES[hover]!.format(v)}</span>
              </p>
            );
          })}
        </div>
      ) : null}

      <ul className="mt-1 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[14px] text-bone">
        {series.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-3 w-5 rounded-[3px] border-2" style={{ borderColor: s.color, background: `${s.color}40` }} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
