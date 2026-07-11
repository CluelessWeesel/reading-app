import { Pool } from "pg";

// Reuse a single Pool across hot-reloads in dev; otherwise Next.js recreates
// this module (and a fresh Pool) on nearly every request and exhausts
// Supabase's connection limit.
declare global {
  var pgPool: Pool | undefined;
}

export const pool =
  global.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  global.pgPool = pool;
}
