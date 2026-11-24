import "server-only";
import { createHash, randomInt } from "node:crypto";

// No 0/O, 1/I/L: codes are read aloud and typed by hand.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** A 12-character code like 7KQ2-MX9D-PHT4 (~59 bits of randomness). */
export function generateCode(): string {
  let raw = "";
  for (let i = 0; i < 12; i++) raw += ALPHABET[randomInt(ALPHABET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** Only the hash is stored, so a leaked database doesn't leak usable codes. */
export function hashCode(code: string): string {
  return createHash("sha256").update(normalizeCode(code)).digest("hex");
}

export function codeHint(code: string): string {
  return normalizeCode(code).slice(-4);
}
