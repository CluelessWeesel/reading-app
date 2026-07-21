import { daysBetweenInclusive } from "../shared/isoDate";

export type FiveStarDrought = {
  daysSince: number;
  booksSince: number;
  lastTitle: string;
  recordDays: number;
  isCurrentRecord: boolean;
};

// allFiveStarDates is every score=5 book's date_finished, ascending --
// used to find the longest-ever gap between five-star reads (the
// "record" drought), which may or may not be the one happening right now.
export function computeFiveStarDrought(
  lastFiveStarDate: string | null,
  lastFiveStarTitle: string | null,
  booksSinceCount: number,
  allFiveStarDates: string[],
  today: string
): FiveStarDrought | null {
  if (lastFiveStarDate == null || lastFiveStarTitle == null) return null;
  const daysSince = daysBetweenInclusive(lastFiveStarDate, today) - 1;

  let recordDays = daysSince;
  for (let i = 1; i < allFiveStarDates.length; i++) {
    const gap = daysBetweenInclusive(allFiveStarDates[i - 1], allFiveStarDates[i]) - 1;
    recordDays = Math.max(recordDays, gap);
  }

  return {
    daysSince,
    booksSince: booksSinceCount,
    lastTitle: lastFiveStarTitle,
    recordDays,
    isCurrentRecord: daysSince >= recordDays,
  };
}
