"use client";

import clsx from "clsx";
import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { buttonClass } from "./button";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { pendingLabel?: string; variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, className)} {...props}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

export function TextField({
  label,
  name,
  error,
  hint,
  className,
  ...input
}: ComponentProps<"input"> & { label: string; name: string; error?: string; hint?: ReactNode }) {
  const id = `f-${name}`;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-fog">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="field"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        {...input}
      />
      {error ? (
        <p id={`${id}-err`} className="text-[13px] text-loss">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-dim">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  name,
  error,
  hint,
  options,
  className,
  ...select
}: ComponentProps<"select"> & {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  options: { value: string; label: string }[];
}) {
  const id = `f-${name}`;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-fog">
        {label}
      </label>
      <select id={id} name={name} className="field" aria-invalid={error ? true : undefined} {...select}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-[13px] text-loss">{error}</p> : hint ? <p className="text-[13px] text-dim">{hint}</p> : null}
    </div>
  );
}

export function FormAlert({ error, success }: { error?: string | null; success?: string | null }) {
  if (!error && !success) return null;
  const isError = Boolean(error);
  return (
    <div
      role={isError ? "alert" : "status"}
      className={clsx(
        "flex items-start gap-2.5 border px-3.5 py-3 text-[14px]",
        isError ? "border-loss/40 bg-loss/[0.07] text-bone" : "border-win/40 bg-win/[0.07] text-bone",
      )}
    >
      {isError ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-loss" aria-hidden />
      ) : (
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-win" aria-hidden />
      )}
      <span>{error ?? success}</span>
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  error,
  hint,
  className,
  rows = 4,
  ...area
}: ComponentProps<"textarea"> & { label: string; name: string; error?: string; hint?: ReactNode }) {
  const id = `f-${name}`;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-fog">
        {label}
      </label>
      <textarea id={id} name={name} rows={rows} className="field resize-y leading-relaxed" aria-invalid={error ? true : undefined} {...area} />
      {error ? <p className="text-[13px] text-loss">{error}</p> : hint ? <p className="text-[13px] text-dim">{hint}</p> : null}
    </div>
  );
}

export function CheckboxField({
  label,
  name,
  hint,
  className,
  ...input
}: ComponentProps<"input"> & { label: ReactNode; name: string; hint?: ReactNode }) {
  return (
    <label className={clsx("flex cursor-pointer items-start gap-2.5", className)}>
      <input type="checkbox" name={name} className="mt-[3px] size-4 shrink-0 accent-[var(--accent)]" {...input} />
      <span>
        <span className="block text-[14.5px] text-bone">{label}</span>
        {hint ? <span className="block text-[13px] text-dim">{hint}</span> : null}
      </span>
    </label>
  );
}

export function FormSection({ title, description, children, className }: { title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={clsx("min-w-0 border-t border-line pt-6", className)}>
      <legend className="sr-only">{title}</legend>
      <h2 className="type-display text-[19px] font-bold text-bone">{title}</h2>
      {description ? <p className="mt-1 text-[13.5px] text-fog">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}
