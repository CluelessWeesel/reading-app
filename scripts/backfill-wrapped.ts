// Backfills Wrapped for every fully-completed year (2023 through last
// year) -- same "call the live app's own API" reasoning as
// backfill-recaps.ts (generateStory.ts pulls in server-only @/ modules
// that don't reliably resolve from a bare tsx script). Requires the app
// (dev or prod) to already be running.
//
// Deletes any existing row for each target year first: a stale row from
// before the rich 13-card Wrapped existed (or a leftover December
// "projected" deck for a year that's since ended) would otherwise make
// POST /api/stories/generate return 409 and skip regenerating it.
//
// Usage:
//   npm run backfill:wrapped                        -- dry run, lists years
//   npm run backfill:wrapped -- --write              -- regenerates each year
//   npm run backfill:wrapped -- --write --base-url=https://example.com

import { config } from "dotenv";
import path from "node:path";
import pg from "pg";
import { SITE_AUTH_COOKIE, getExpectedAuthCookieValue } from "../lib/sitePasscode";

config({ path: path.join(process.cwd(), ".env.local") });

const WRITE = process.argv.includes("--write");
const baseUrlArg = process.argv.find((a) => a.startsWith("--base-url="));
const BASE_URL = baseUrlArg ? baseUrlArg.split("=")[1] : "http://localhost:3000";

const authCookieValue = getExpectedAuthCookieValue();
if (WRITE && !authCookieValue) {
  throw new Error("SITE_PASSCODE is not set in .env.local -- can't authenticate against the running app.");
}
const COOKIE_HEADER = authCookieValue ? `${SITE_AUTH_COOKIE}=${authCookieValue}` : "";

const APP_START_YEAR = 2023;

function lastCompletedYear(): number {
  return new Date().getFullYear() - 1;
}

function allYears(throughYear: number): number[] {
  const years: number[] = [];
  for (let y = APP_START_YEAR; y <= throughYear; y++) years.push(y);
  return years;
}

async function deleteExistingRows(pool: pg.Pool, years: number[]): Promise<void> {
  const { rowCount } = await pool.query(
    `delete from generated_stories where story_type = 'wrapped' and period = any($1)`,
    [years.map(String)]
  );
  console.log(`Cleared ${rowCount} existing wrapped row(s) for ${years.join(", ")}.\n`);
}

async function main() {
  const through = lastCompletedYear();
  const years = allYears(through);

  console.log("=".repeat(70));
  console.log(WRITE ? "WRITE MODE -- regenerating Wrapped for each completed year" : "DRY RUN -- listing years to check");
  console.log("=".repeat(70));
  console.log(`Years: ${years.join(", ")}`);
  console.log(`Server: ${BASE_URL}\n`);

  if (!WRITE) {
    for (const year of years) console.log(`  ${year}`);
    console.log("\nDry run only -- re-run with --write to apply (server must be running).");
    return;
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await deleteExistingRows(pool, years);
  await pool.end();

  let created = 0;
  let failed = 0;

  for (const year of years) {
    try {
      const res = await fetch(`${BASE_URL}/api/stories/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: COOKIE_HEADER },
        body: JSON.stringify({ story_type: "wrapped", period: String(year) }),
      });
      if (res.status === 201) {
        console.log(`  ✓ generated ${year}`);
        created++;
      } else {
        const body = await res.json().catch(() => ({}));
        console.log(`  ✗ failed ${year}: ${body.error ?? res.status}`);
        failed++;
      }
    } catch (err) {
      console.log(`  ✗ failed ${year}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Created: ${created}`);
  console.log(`Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
