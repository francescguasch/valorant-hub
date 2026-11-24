"use client";

import { useEffect, useRef, useState } from "react";

export type FormPoint = {
  id: string;
  date: string;
  opponent: string;
  map: string;
  score: string;
  diff: number;
  result: "W" | "L" | "D";
  type: string;
};

const COLOR = { W: "var(--color-win)", L: "var(--color-loss)", D: "var(--color-draw)" } as const;
const WORD = { W: "Win", L: "Loss", D: "Draw" } as const;

const H = 220;
const PAD_TOP = 14;
const PAD_BOTTOM = 14;
const AXIS_W = 30;

/** Bar path with a 4px rounded data-end and a square end on the baseline. */
function barPath(x: number, w: number, y0: number, y1: number) {
  const r = Math.min(4, w / 2, Math.abs(y1 - y0));
  if (y1 < y0) {
    return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`;
  }
  return `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 - r} V${y0} Z`;
}

export function FormChart({ points: allPoints }: { points: FormPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(720);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Draw at the real pixel width so labels stay readable on phones.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = width < 520 ? allPoints.slice(-10) : allPoints;
  const maxAbs = Math.max(6, ...points.map((p) => Math.abs(p.diff)));
  const step = maxAbs > 10 ? 10 : 5;
  const top = Math.ceil(maxAbs / step) * step;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const y = (v: number) => PAD_TOP + plotH / 2 - (v / top) * (plotH / 2);
  const slot = (width - AXIS_W) / Math.max(points.length, 1);
  const barW = Math.min(24, slot - 6);
  const ticks = [top, top / 2, 0, -top / 2, -top];
  const current = active !== null ? points[active] : null;

  return (
    <div>
      <div ref={wrapRef} className="relative" onPointerLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${width} ${H}`} width={width} height={H} className="block max-w-full" role="group" aria-label="Round difference per match, oldest to newest">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={AXIS_W}
                x2={width}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? "var(--color-line-strong)" : "var(--color-line)"}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text x={AXIS_W - 8} y={y(t) + 4} textAnchor="end" className="fill-dim text-[11px] [font-variant-numeric:tabular-nums]">
                {t > 0 ? `+${t}` : t}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const cx = AXIS_W + slot * i + slot / 2;
            const x = cx - barW / 2;
            const isActive = active === i;
            return (
              <g
                key={p.id}
                tabIndex={0}
                role="img"
                aria-label={`${p.date}, ${p.opponent} on ${p.map}: ${WORD[p.result]} ${p.score}`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="cursor-default outline-none"
              >
                <rect x={cx - slot / 2} y={PAD_TOP} width={slot} height={plotH} fill="transparent" />
                {isActive ? <rect x={cx - slot / 2 + 1} y={PAD_TOP} width={slot - 2} height={plotH} fill="white" opacity={0.035} /> : null}
                {p.diff === 0 ? (
                  <rect x={x} y={y(0) - 2} width={barW} height={4} rx={1} fill={COLOR.D} />
                ) : (
                  <path d={barPath(x, barW, y(0), y(p.diff))} fill={COLOR[p.result]} opacity={active === null || isActive ? 1 : 0.55} />
                )}
              </g>
            );
          })}
        </svg>

        {current && active !== null ? (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max max-w-[220px] -translate-x-1/2 border border-line-strong bg-raised px-3 py-2 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            style={{ left: `${((AXIS_W + slot * active + slot / 2) / width) * 100}%` }}
          >
            <p className="num text-[22px] font-semibold leading-none text-bone">{current.score}</p>
            <p className="mt-1 text-fog">
              <span className="mr-1.5 inline-block h-0.5 w-3 align-middle" style={{ background: COLOR[current.result] }} />
              {WORD[current.result]} vs {current.opponent}
            </p>
            <p className="text-dim">
              {current.map} · {current.date} · {current.type}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-fog">
        <ul className="flex gap-4" aria-label="Legend">
          {(["W", "L", "D"] as const).map((r) => (
            <li key={r} className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-[2px]" style={{ background: COLOR[r] }} />
              {WORD[r]}
            </li>
          ))}
        </ul>
        <details className="group">
          <summary className="cursor-pointer select-none text-fog hover:text-bone">Show as table</summary>
          <div className="mt-3 max-h-64 max-w-[calc(100vw-5rem)] overflow-auto border border-line">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-raised text-fog">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Opponent</th>
                  <th className="px-3 py-2 font-medium">Map</th>
                  <th className="px-3 py-2 font-medium">Score</th>
                  <th className="px-3 py-2 font-medium">Diff</th>
                </tr>
              </thead>
              <tbody>
                {[...allPoints].reverse().map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-3 py-1.5">{p.date}</td>
                    <td className="px-3 py-1.5">{p.opponent}</td>
                    <td className="px-3 py-1.5">{p.map}</td>
                    <td className="px-3 py-1.5">{p.score}</td>
                    <td className="px-3 py-1.5">{p.diff > 0 ? `+${p.diff}` : p.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  );
}
