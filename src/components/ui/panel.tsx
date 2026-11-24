import clsx from "clsx";
import type { ReactNode } from "react";

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx("min-w-0 border border-line bg-panel", className)}>
      {title ? (
        <header className="flex items-end justify-between gap-4 border-b border-line px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 className="type-display text-[19px] font-bold text-bone">{title}</h2>
            {description ? <p className="mt-1 text-[13px] text-fog">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={clsx("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 border border-dashed border-line-strong/70 px-5 py-6">
      <p className="font-semibold text-bone">{title}</p>
      {children ? <div className="max-w-prose text-[14px] text-fog">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      title="Demo record. Remove all demo data in Settings → Data."
      className={clsx(
        "inline-flex h-[18px] items-center border border-demo/50 px-1.5 font-display text-[11px] font-bold tracking-[0.08em] text-demo",
        className,
      )}
    >
      DEMO
    </span>
  );
}

export function ResultChip({ result, size = "md" }: { result: "W" | "L" | "D"; size?: "sm" | "md" }) {
  const label = result === "W" ? "Win" : result === "L" ? "Loss" : "Draw";
  return (
    <span
      aria-label={label}
      title={label}
      className={clsx(
        "inline-grid place-items-center font-display font-bold",
        size === "sm" ? "size-6 text-[13px]" : "size-8 text-[16px]",
        "text-ink",
        result === "W" && "bg-win",
        result === "L" && "bg-loss",
        result === "D" && "bg-draw",
      )}
    >
      {result}
    </span>
  );
}
