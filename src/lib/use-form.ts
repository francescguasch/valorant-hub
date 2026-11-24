"use client";

import { useActionState } from "react";
import { initialFormState, type FormState } from "./forms";

const SECRET_FIELDS = new Set(["password", "confirm", "current", "token"]);

/**
 * useActionState plus: when the server rejects a form, keep what the person
 * typed (React resets forms after every action). Passwords are never kept.
 */
export function useForm(action: (prev: FormState, data: FormData) => Promise<FormState>) {
  return useActionState(async (prev: FormState, data: FormData) => {
    const result = await action(prev, data);
    if (result.success) return result;
    const values: Record<string, string> = {};
    for (const [k, v] of data.entries()) if (typeof v === "string" && !SECRET_FIELDS.has(k)) values[k] = v;
    return { ...result, values };
  }, initialFormState);
}
