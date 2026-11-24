"use client";

import { useActionState, useState, type ReactNode } from "react";
import { initialFormState, type FormState } from "@/lib/forms";
import { FormAlert, SubmitButton } from "./form";
import { buttonClass } from "./button";

/**
 * A button that asks "are you sure?" inline before running a destructive
 * server action. No browser pop-ups; Escape or Cancel backs out.
 */
export function ConfirmAction({
  action,
  hidden,
  label,
  confirmLabel,
  question,
  variant = "danger",
  className,
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  label: ReactNode;
  confirmLabel: string;
  question: string;
  variant?: "danger" | "secondary";
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <div className={className}>
      {asking && !state.success ? (
        <form
          action={formAction}
          className="flex flex-wrap items-center gap-2"
          onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
        >
          {Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <span className="text-[13.5px] text-bone">{question}</span>
          <SubmitButton variant={variant} pendingLabel="Working…" className="h-9" autoFocus>
            {confirmLabel}
          </SubmitButton>
          <button type="button" className={buttonClass("ghost")} onClick={() => setAsking(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className={buttonClass(variant, "h-9")} onClick={() => setAsking(true)}>
          {label}
        </button>
      )}
      {state.error || state.success ? (
        <div className="mt-2">
          <FormAlert error={state.error} success={state.success} />
        </div>
      ) : null}
    </div>
  );
}
