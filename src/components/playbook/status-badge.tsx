import clsx from "clsx";
import { STRATEGY_STATUS_LABEL } from "@/lib/constants";

const STATUS_STYLE: Record<string, string> = {
  approved: "border-win/50 text-win",
  practicing: "border-demo/50 text-demo",
  in_development: "border-line-strong text-fog",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx("inline-flex h-[20px] items-center whitespace-nowrap border px-1.5 text-[11.5px] font-semibold", STATUS_STYLE[status])}>
      {STRATEGY_STATUS_LABEL[status]}
    </span>
  );
}
