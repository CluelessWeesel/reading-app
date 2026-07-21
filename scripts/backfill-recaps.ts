// Backfills monthly recaps from Jan 2023 through the last fully-completed
// month. The actual computation (app/stories/generateStory.ts) imports
// server-only app modules via the @/ alias, which don't reliably resolve
// in a standalone tsx script -- so this calls the live app's own
// /api/stories/generate route instead, exactly like a normal user action
// would. Requires the app (dev or prod) to already be running.
//
// Every request needs proxy.ts's site_auth cookie (it locks the whole app,
// API routes included) -- computed here the same way it's set at unlock
// time, from SITE_PASSCODE in .env.local, rather than a hardcoded value.
//
// Usage:
//   npm run backfill:recaps                        -- dry run, lists periods
//   npm run backfill:recaps -- --write              -- generates each missing month
//   npm run backfill:recaps -- --write --base-url=https://example.com

import { config } from "dotenv";
import path from "node:path";
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

function lastCompletedMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

function allPeriods(throughPeriod: string): string[] {
  const periods: string[] = [];
  const [throughY, throughM] = throughPeriod.split("-").map(Number);
  for (let y = APP_START_YEAR; y <= throughY; y++) {
    const lastM = y === throughY ? throughM : 12;
    for (let m = 1; m <= lastM; m++) {
      periods.push(`${y}-${String(m).padStart(2, "0")}`);
    }
  }
  return periods;
}

async function main() {
  const through = lastCompletedMonth();
  const periods = allPeriods(through);

  console.log("=".repeat(70));
  console.log(WRITE ? "WRITE MODE -- generating missing recaps" : "DRY RUN -- listing periods to check");
  console.log("=".repeat(70));
  console.log(`Periods: ${periods[0]} through ${periods[periods.length - 1]} (${periods.length} months)`);
  console.log(`Server: ${BASE_URL}\n`);

  if (!WRITE) {
    for (const period of periods) console.log(`  ${period}`);
    console.log("\nDry run only -- re-run with --write to apply (server must be running).");
    return;
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const period of periods) {
    try {
      const res = await fetch(`${BASE_URL}/api/stories/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: COOKIE_HEADER },
        body: JSON.stringify({ story_type: "recap", period }),
      });
      if (res.status === 201) {
        console.log(`  ✓ generated ${period}`);
        created++;
      } else if (res.status === 409) {
        console.log(`  · already exists ${period}`);
        skipped++;
      } else {
        const body = await res.json().catch(() => ({}));
        console.log(`  ✗ failed ${period}: ${body.error ?? res.status}`);
        failed++;
      }
    } catch (err) {
      console.log(`  ✗ failed ${period}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Created: ${created}`);
  console.log(`Already existed: ${skipped}`);
  console.log(`Failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
