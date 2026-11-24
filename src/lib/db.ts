import "server-only";
import postgres from "postgres";
import { serverEnv } from "./env";

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

export type Tx = postgres.TransactionSql;
export type Actor = { userId: string; email?: string | null } | null;

export async function withActor<T>(actor: Actor, fn: (tx: Tx) => Promise<T>): Promise<T> {
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
  const result = await db().begin((tx) => fn(tx));
  return result as T;
}

/** Turn a Postgres error into a sentence a coach can act on. */
export function friendlyDbError(error: unknown): string {
  const e = error as { code?: string; message?: string; constraint_name?: string };
  if (e?.code === "42501") return e.message?.includes("row-level security")
    ? "You don't have permission to do that."
    : (e.message ?? "You don't have permission to do that.");
  if (e?.code === "23505") return "That name is already in use.";
  if (e?.code === "23514" || e?.code === "23503" || e?.code === "P0001") return e.message ?? "That change isn't valid.";
  console.error(error);
  return "Something went wrong while saving. Try again in a moment.";
}
