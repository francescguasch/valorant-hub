import Link from "next/link";
import type { ReactNode } from "react";

/** One row of filters above the content they scope. Plain GET form: works without JavaScript. */
export function FilterBar({ children, resetHref, active }: { children: ReactNode; resetHref: string; active: boolean }) {
  return (
    <form method="get" className="mb-6 flex flex-wrap items-end gap-3 border border-line bg-panel px-4 py-3">
      {children}
      <div className="flex gap-2">
        <button type="submit" className="h-[42px] border border-line-strong px-4 font-display text-[15px] font-semibold uppercase tracking-[0.04em] text-bone hover:border-bone/60">
          Apply
        </button>
        {active ? (
          <Link href={resetHref} className="grid h-[42px] place-items-center px-3 text-[14px] text-fog hover:text-bone">
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}

export function FilterSelect({
  label,
  name,
  value,
  options,
  allLabel = "All",
}: {
  label: string;
  name: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  return (
    <label className="flex min-w-[140px] flex-col gap-1">
      <span className="text-[12.5px] text-fog">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="field h-[42px] py-0">
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterDate({ label, name, value }: { label: string; name: string; value: string | undefined }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12.5px] text-fog">{label}</span>
      <input type="date" name={name} defaultValue={value ?? ""} className="field h-[42px] py-0 [color-scheme:dark]" />
    </label>
  );
}
