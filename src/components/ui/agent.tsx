/* eslint-disable @next/next/no-img-element */
import clsx from "clsx";
import { TriangleAlert } from "lucide-react";

export function AgentIcon({
  name,
  image,
  size = 28,
  className,
}: {
  name: string;
  image: string | null;
  size?: number;
  className?: string;
}) {
  return image ? (
    <img
      src={image}
      alt={name}
      title={name}
      width={size}
      height={size}
      loading="lazy"
      className={clsx("shrink-0 bg-raised object-cover ring-1 ring-line", className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      title={name}
      aria-label={name}
      className={clsx("grid shrink-0 place-items-center bg-raised font-display font-bold text-fog ring-1 ring-line", className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
    >
      {name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase()}
    </span>
  );
}

export function Comp({ agents, size = 28 }: { agents: { id: string; name: string; image: string | null }[]; size?: number }) {
  return (
    <span className="flex gap-1" aria-label={agents.map((a) => a.name).join(", ")}>
      {agents.map((a) => (
        <AgentIcon key={a.id} name={a.name} image={a.image} size={size} />
      ))}
    </span>
  );
}

export function SmallSample({ played }: { played: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[12px] text-dim"
      title={`Only ${played} match${played === 1 ? "" : "es"}. Percentages need at least 3 to mean much.`}
    >
      <TriangleAlert className="size-3" aria-hidden />
      Small sample
    </span>
  );
}

/** Horizontal magnitude bar, 0–100%. Value text sits outside the bar in text colour. */
export function RateBar({ value, label }: { value: number | null; label?: string }) {
  const pct = value === null ? 0 : Math.round(value * 100);
  return (
    <span className="flex items-center gap-3">
      <span className="relative h-2 flex-1 bg-line" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-accent-2/85" style={{ width: `${pct}%` }} />
      </span>
      <span className="num w-11 text-right text-[17px] font-semibold text-bone">{label ?? (value === null ? "—" : `${pct}%`)}</span>
    </span>
  );
}
