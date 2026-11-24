// Concatenates supabase/migrations/*.sql into supabase/setup.sql, a single file
// that can be pasted into the Supabase SQL editor for a fresh project.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "supabase/migrations";
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const header = `-- =============================================================================
-- VALORANT Team Hub: complete database setup for a NEW Supabase project.
-- Generated from supabase/migrations by \`npm run db:bundle\`. Do not edit by hand.
-- Paste everything into Supabase → SQL Editor → New query, then press Run.
-- =============================================================================
`;
const body = files.map((f) => `\n-- >>> ${f}\n${readFileSync(join(dir, f), "utf8").trim()}\n`).join("");
writeFileSync("supabase/setup.sql", header + body);
console.log(`supabase/setup.sql written from ${files.length} migrations`);
