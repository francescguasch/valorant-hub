import "server-only";
import type postgres from "postgres";
import { MIGRATIONS } from "./migrations.generated";

/**
 * Applies database migrations that haven't run yet, once per server instance.
 * New versions of the hub can therefore change the database without anyone
 * pasting SQL into Supabase. Everything runs in one transaction under an
 * advisory lock, so parallel cold starts can't apply the same change twice.
 * Set AUTO_MIGRATE=false to turn it off and apply supabase/migrations by hand.
 */

// Projects created with the first setup.sql (before migrations were tracked) already contain these.
const BASELINE = "20261124000500_owner_bootstrap";

export async function applyPendingMigrations(sql: postgres.Sql): Promise<string[]> {
  if (process.env.AUTO_MIGRATE === "false") return [];
  const applied: string[] = [];
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(727274)`;
    await tx`create schema if not exists app`;
    await tx`create table if not exists app.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
    const done = new Set((await tx<{ name: string }[]>`select name from app.schema_migrations`).map((r) => r.name));
    if (done.size === 0) {
      const [row] = await tx<{ exists: boolean }[]>`select to_regclass('public.team_settings') is not null as exists`;
      if (row?.exists) {
        for (const m of MIGRATIONS.filter((x) => x.name <= BASELINE)) {
          await tx`insert into app.schema_migrations (name) values (${m.name}) on conflict do nothing`;
          done.add(m.name);
        }
      }
    }
    for (const m of MIGRATIONS) {
      if (done.has(m.name)) continue;
      await tx.unsafe(m.sql);
      await tx`insert into app.schema_migrations (name) values (${m.name})`;
      applied.push(m.name);
    }
  });
  if (applied.length) console.info(`[migrate] applied ${applied.join(", ")}`);
  return applied;
}
