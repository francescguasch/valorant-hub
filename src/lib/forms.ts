import type { ZodError } from "zod";

/** Result returned by every form's server action. */
export type FormState = {
  error: string | null;
  fields: Record<string, string>;
  success?: string | null;
  /** One-time value to show after saving, e.g. a freshly generated invitation code. */
  reveal?: string | null;
  /** What the person typed, echoed back after a rejected submit. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { error: null, fields: {} };

export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
