import { pool } from "@/lib/db";
import { computeStoryPayload } from "./generateStory";
import { APP_START_YEAR } from "./recapMath";

type WrappedFinalRow = { payload: { final?: boolean } };

async function upsertWrapped(period: string): Promise<void> {
  const payload = await computeStoryPayload("wrapped", period);
  await pool.query(
    `insert into generated_stories (story_type, period, payload) values ('wrapped', $1, $2) on conflict (story_type, period) do nothing`,
    [period, JSON.stringify(payload)]
  );
}

async function refreezeWrapped(period: string): Promise<void> {
  const payload = await computeStoryPayload("wrapped", period);
  await pool.query(`update generated_stories set payload = $2, generated_at = now() where story_type = 'wrapped' and period = $1`, [
    period,
    JSON.stringify(payload),
  ]);
}

// Called on every home page load, same "cheap check almost always, real
// work rarely" shape as ensureLatestRecapGenerated. Two independent things
// can happen here:
//
// 1. December 1st onward: the current (still in-progress) year gets a
//    projected Wrapped if it doesn't have one yet -- computeStoryPayload
//    marks it payload.final = false automatically (year === currentYear).
// 2. Whenever the most recently completed year's Wrapped either doesn't
//    exist yet, or exists but is still stamped payload.final = false (the
//    December projection, now that the year it described is actually
//    over) -- generate or re-freeze it with real, final numbers.
//
// Failures are swallowed (logged, not thrown), same reasoning as the recap
// version: a generation hiccup shouldn't take the home page down with it.
export async function ensureWrappedGenerated(today: string): Promise<void> {
  const currentYear = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));

  try {
    if (month === 12) {
      const { rows } = await pool.query(`select 1 from generated_stories where story_type = 'wrapped' and period = $1`, [
        String(currentYear),
      ]);
      if (rows.length === 0) await upsertWrapped(String(currentYear));
    }

    const lastYear = currentYear - 1;
    if (lastYear >= APP_START_YEAR) {
      const { rows } = await pool.query<WrappedFinalRow>(
        `select payload from generated_stories where story_type = 'wrapped' and period = $1`,
        [String(lastYear)]
      );
      const existing = rows[0];
      if (!existing) await upsertWrapped(String(lastYear));
      else if (existing.payload.final === false) await refreezeWrapped(String(lastYear));
    }
  } catch (err) {
    console.error("Failed to auto-generate/finalize Wrapped", err);
  }
}
