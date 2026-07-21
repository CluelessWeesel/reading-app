import { pool } from "@/lib/db";
import { computeStoryPayload } from "./generateStory";

export function lastCompletedMonth(today: string): string {
  const [y, m] = today.slice(0, 7).split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

// Called on every home page load -- a cheap existence check almost all the
// time, and only does real work (computing + freezing a whole recap) on
// the first load after a new month starts, for the month that just ended.
// Failures are swallowed (logged, not thrown) so a generation hiccup never
// takes the home page down with it.
export async function ensureLatestRecapGenerated(today: string): Promise<void> {
  const period = lastCompletedMonth(today);
  try {
    const { rows } = await pool.query(`select 1 from generated_stories where story_type = 'recap' and period = $1`, [period]);
    if (rows.length > 0) return;

    const payload = await computeStoryPayload("recap", period);
    await pool.query(
      `insert into generated_stories (story_type, period, payload) values ('recap', $1, $2) on conflict (story_type, period) do nothing`,
      [period, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error("Failed to auto-generate recap for", period, err);
  }
}
