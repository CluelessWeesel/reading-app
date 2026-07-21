@AGENTS.md

# The Weeselry — a personal reading tracker

Next.js App Router + Turbopack + TypeScript + Tailwind v4 (CSS-first config, tokens in `app/globals.css`).
Direct `pg` Pool against Supabase Postgres — **no ORM**. One user, no staging environment: all testing happens against real production data.

## Working with the database

- Schema changes are plain SQL files in `supabase/migrations/NNNN_description.sql`, numbered sequentially. There is no migration CLI/runner — apply a new file by hand with a disposable script:
  ```js
  // scripts/_apply-migration.mjs
  import { config } from "dotenv"; import fs from "node:fs"; import pg from "pg";
  config({ path: ".env.local" });
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pool.query(fs.readFileSync(process.argv[2], "utf8"));
  ```
  then delete the script. Before altering a constraint, check its actual generated name first (`select conname from pg_constraint where conrelid = 'table'::regclass`) — don't assume Postgres's default naming.
- One-off DB checks/backfills: write to `scripts/_check-*.mjs` / `scripts/_verify-*.mjs`, run with `node`, delete immediately after use. Never leave throwaway scripts in the repo.
- Frozen/derived data (generated_stories, tier boards, etc.) that depends on since-fixed logic needs an explicit wipe-and-regenerate, not just a code fix — check for a `backfill:*` npm script first.

## Working with the dev server

No browser tool is available in this environment — verify UI work via `curl` against rendered HTML/JSON, not by looking at it.

```
ps aux | grep "next dev" | grep -v grep | awk '{print $2}' | xargs -r kill
nohup npm run dev > /tmp/next-dev.log 2>&1 & disown
sleep 6
curl -s -b "site_auth=<value>" http://localhost:3000/some-route
```

Every route, including API routes, is gated by `proxy.ts` on a `site_auth` cookie (see `lib/sitePasscode.ts`) — any script or curl call hitting the app's own HTTP API needs that cookie or gets `{"error":"Locked"}`.

Always finish a piece of work with `npx tsc --noEmit` and `npx eslint <touched paths>` — both must be clean (pre-existing unrelated lint debt elsewhere in the repo is expected and not yours to fix incidentally).

## House conventions worth knowing before writing new UI

- No charting library — line/area/bar charts are hand-rolled SVG (`viewBox`, `preserveAspectRatio="none"`, manual `M`/`L` path strings, `currentColor` + CSS variable tokens). See `app/stats/PaceHeroChart.tsx` for the canonical example.
- A Client Component's static function properties (e.g. `Widget.size = "x"`) do NOT survive being read from a Server Component — keep the widget itself a Server Component and push interactivity into a nested `"use client"` leaf.
- Drag-and-drop is hand-rolled Pointer Events (mouse + touch unified), not a library — track drag state in refs (not just React state) since pointermove/pointerup handlers are attached once per gesture and would otherwise close over stale values.
- `app_settings` is a flat key/value table (`app/api/app-settings/route.ts`) — reach for it before adding a new settings table.
- A day without a `daily_reading` row is absent, not zero-logged — don't treat missing days as zero when computing rates/averages, and don't count "today" in a per-day average/projection until it actually has a row (reading gets logged at day's end, not throughout it).
- Root-cause fixes over one-off patches: when a bug is systemic (e.g. a field only ever set by a batch script, never by the live write path), fix the write path, don't just backfill the one instance.

