import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 font-display uppercase tracking-[0.04em] font-semibold text-[15px] leading-none transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "cut-corner bg-accent text-white hover:brightness-110 active:brightness-95 px-5 h-11",
  secondary: "border border-line-strong text-bone hover:border-bone/60 hover:bg-white/[0.03] px-4 h-10 rounded-[2px]",
  ghost: "text-fog hover:text-bone hover:bg-white/[0.04] px-3 h-9 rounded-[2px]",
  danger: "border border-loss/50 text-loss hover:bg-loss/10 px-4 h-10 rounded-[2px]",
};

export function buttonClass(variant: Variant = "primary", className?: string) {
  return clsx(base, variants[variant], className);
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  href,
  children,
}: {
  variant?: Variant;
  className?: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
