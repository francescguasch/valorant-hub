import "server-only";
import postgres from "postgres";
import { serverEnv } from "./env";
import { applyPendingMigrations } from "./migrate";

/**
 * Database access.
 *
 * Every query made on behalf of a person runs inside `withActor`, which switches
 * the transaction to Postgres' `authenticated` (or `anon`) role and passes the
 * user id the same way Supabase does. Row Level Security policies therefore
 * apply exactly as they would through the Supabase API: the database, not the
 * interface, decides what each person may read or change.
 *
 * `asSystem` skips RLS and is reserved for the few trusted server flows that
 * happen before someone has an account (invitation codes, password reset codes,
 * first-owner setup).
 */

declare global {
  var __hubSql: postgres.Sql | undefined;
  var __hubReady: Promise<unknown> | undefined;
}

function createPool() {
  return postgres(serverEnv.databaseUrl(), {
    prepare: false, // required by Supabase's transaction pooler
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    types: {
      // Keep DATE columns as 'YYYY-MM-DD' strings so no timezone shifts them.
      date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v },
    },
  });
}

export function db(): postgres.Sql {
  if (!globalThis.__hubSql) globalThis.__hubSql = createPool();
  return globalThis.__hubSql;
}

/** Resolves once pending migrations are applied (first call per server instance). */
function ready(): Promise<unknown> {
  if (!globalThis.__hubReady) {
    // A failed migration must not take the whole hub down: log it, keep serving,
    // and try again a minute later.
    globalThis.__hubReady = applyPendingMigrations(db()).catch((e) => {
      console.error("[migrate] failed", e);
      setTimeout(() => (globalThis.__hubReady = undefined), 60_000);
    });
  }
  return globalThis.__hubReady;
}

export type Tx = postgres.TransactionSql;
export type Actor = { userId: string; email?: string | null } | null;

export async function withActor<T>(actor: Actor, fn: (tx: Tx) => Promise<T>): Promise<T> {
  await ready();
  const result = await db().begin(async (tx) => {
    const claims = actor
      ? { sub: actor.userId, role: "authenticated", email: actor.email ?? undefined }
      : { role: "anon" };
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`;
    await tx.unsafe(actor ? "set local role authenticated" : "set local role anon");
    return fn(tx);
  });
  return result as T;
}

export async function asSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  await ready();
  const result = await db().begin((tx) => fn(tx));
  return result as T;
}

/** Turn a Postgres error into a sentence a coach can act on. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  matches_half_one: "A half has at most 12 rounds: your T rounds plus their CT rounds can't exceed 12.",
  matches_half_two: "A half has at most 12 rounds: your CT rounds plus their T rounds can't exceed 12.",
  matches_no_ot_in_scrims: "Scrims don't have overtime. Remove the overtime rounds or change the match type.",
  matches_ot_after_12_12: "Overtime only happens after 12–12 in regulation.",
  matches_no_draw_in_competition: "Official and tournament matches can't end in a draw.",
  matches_anti_eco: "Anti-eco rounds won can't be more than anti-eco rounds played.",
  matches_bonus: "Bonus rounds won can't be more than bonus rounds played.",
  matches_first_blood: "Rounds converted after first blood can't be more than first bloods.",
  players_nickname_key: "Another player already uses that nickname.",
  opponents_name_key: "An opponent with that name already exists.",
  maps_name_key: "A map with that name already exists.",
  agents_name_key: "An agent with that name already exists.",
  team_roles_name_key: "A role with that name already exists.",
};

export function friendlyDbError(error: unknown): string {
  const e = error as { code?: string; message?: string; constraint_name?: string };
  if (e?.constraint_name && CONSTRAINT_MESSAGES[e.constraint_name]) return CONSTRAINT_MESSAGES[e.constraint_name]!;
  if (e?.code === "23503" && /still referenced|violates foreign key/.test(e.message ?? "")) {
    return "This is used by other records (for example recorded matches), so it can't be deleted. Hide it instead.";
  }
  if (e?.code === "42501") return e.message?.includes("row-level security")
    ? "You don't have permission to do that."
    : (e.message ?? "You don't have permission to do that.");
  if (e?.code === "23505") return "That name is already in use.";
  if (e?.code === "23514" || e?.code === "23503" || e?.code === "P0001") return e.message ?? "That change isn't valid.";
  console.error(error);
  return "Something went wrong while saving. Try again in a moment.";
}
