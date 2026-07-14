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
    // Supabase's session-mode pooler caps this project at 15 concurrent
    // clients total, shared with one-off scripts -- keep the app's own
    // share small and release idle connections quickly instead of holding
    // them open.
    max: 5,
    idleTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  global.pgPool = pool;
}
