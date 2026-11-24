function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in (see docs/SETUP.es.md).`,
    );
  }
  return value;
}

/**
 * Supabase keys under either naming: the one in .env.example, or the one the
 * Vercel ⇄ Supabase Marketplace integration sets automatically.
 * (NEXT_PUBLIC_* must be written out literally so Next.js inlines them.)
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Values that are safe to expose to the browser. */
export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", SUPABASE_PUBLIC_KEY),
};

/** Postgres URL for the transaction pooler, without options postgres.js doesn't understand. */
function databaseUrl(): string {
  const raw = required("DATABASE_URL", process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) if (key !== "sslmode") url.searchParams.delete(key);
    return url.toString();
  } catch {
    return raw;
  }
}

/** Secrets: only read these from server code. */
export const serverEnv = {
  databaseUrl,
  serviceRoleKey: () =>
    required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY),
  setupToken: () => process.env.SETUP_TOKEN ?? "",
};
