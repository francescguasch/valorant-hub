import "server-only";
import { getViewer, isOwner, isStaff, type Member } from "./viewer";
import type { FormState } from "../forms";

export const DENIED: FormState = { error: "You don't have permission to do that.", fields: {} };

/** For server actions: the signed-in staff member, or null. Re-checked on every call. */
export async function staffOrNull(): Promise<Member | null> {
  const v = await getViewer();
  return isStaff(v) ? v : null;
}
export async function ownerOrNull(): Promise<Member | null> {
  const v = await getViewer();
  return isOwner(v) ? v : null;
}
export async function memberOrNull(): Promise<Member | null> {
  const v = await getViewer();
  return v.kind === "member" ? v : null;
}

/** "" → null, trimmed text otherwise. */
export function text(v: FormDataEntryValue | null | undefined): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}
export function int(v: FormDataEntryValue | null | undefined): number | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
export function num(v: FormDataEntryValue | null | undefined): number | null {
  const s = typeof v === "string" ? v.trim().replace(",", ".") : "";
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
