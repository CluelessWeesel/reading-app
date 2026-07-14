import { addIsoDays, daysBetweenInclusive } from "../shared/isoDate";

// Same "cumulative average since the start, not a rolling window"
// convention used throughout /stats, just applied to a single in-progress
// book. `total` is page_count for physical/ebook or 100 (a percentage) for
// audio -- position already matches the same unit, see positionMath.ts.
export function estimateFinishDate(
  position: number,
  total: number | null,
  dateStarted: string | null,
  today: string
): string | null {
  if (dateStarted == null || total == null || total <= 0 || position <= 0 || position >= total) return null;
  const daysElapsed = daysBetweenInclusive(dateStarted, today);
  if (daysElapsed <= 0) return null;
  const pace = position / daysElapsed;
  if (pace <= 0) return null;
  const daysNeeded = Math.ceil((total - position) / pace);
  return addIsoDays(today, daysNeeded);
}

export function percentComplete(position: number, total: number | null): number {
  if (total == null || total <= 0) return 0;
  return Math.max(0, Math.min(100, (position / total) * 100));
}
