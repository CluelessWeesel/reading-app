export type Velocity = { pagesPerDay: number; targetPagesPerDay: number; percent: number };

// Current pace vs. a target daily pace: the goal-implied rate (goal /
// days-in-year) if a goal's set this year, otherwise last year's own final
// average pace as the baseline. Returns null if neither exists -- nothing
// to gauge against.
export function computeVelocity(
  pagesPerDay: number,
  goal: number | null,
  daysInYear: number,
  priorYearAvgPace: number | null
): Velocity | null {
  const target = goal != null && goal > 0 ? goal / daysInYear : priorYearAvgPace;
  if (target == null || target <= 0) return null;
  const percent = Math.max(0, Math.min(150, (pagesPerDay / target) * 100));
  return { pagesPerDay, targetPagesPerDay: target, percent };
}
