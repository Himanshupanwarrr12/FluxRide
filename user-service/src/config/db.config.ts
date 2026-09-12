import "dotenv/config";

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Fall back to granular env vars
  const host = process.env.DB_HOST ?? "localhost";
  const port = process.env.DB_PORT ?? "5432";
  const user = process.env.DB_USER ?? "postgres";
  const password = process.env.DB_PASSWORD ?? "postgres";
  const name = process.env.DB_NAME ?? "user_db";

  return `postgresql://${user}:${password}@${host}:${port}/${name}?schema=public`;
}

export const databaseUrl = buildDatabaseUrl();

export const poolConfig = {
  max: 20,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 30_000,
} as const;
