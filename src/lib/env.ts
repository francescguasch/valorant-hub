function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in (see docs/SETUP.es.md).`,
    );
  }
  return value;
}

/** Values that are safe to expose to the browser. */
export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
};

/** Secrets: only read these from server code. */
export const serverEnv = {
  databaseUrl: () => required("DATABASE_URL", process.env.DATABASE_URL),
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  setupToken: () => process.env.SETUP_TOKEN ?? "",
};
