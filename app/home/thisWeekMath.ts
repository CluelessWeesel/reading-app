import { addIsoDays } from "../shared/isoDate";
import type { DailyRow } from "../stats/types";

export type RankMove = { bookId: number; title: string; oldRank: number | null; newRank: number };

export type ThisWeek = {
  rankMoves: RankMove[];
  finishesCount: number;
  pagesThisWeek: number;
  avgWeekPages: number;
};

// pagesPerDay is the year's own cumulative-average pace (same figure used
// everywhere else on Home) -- avgWeekPages is just that scaled to 7 days,
// not a separately-tracked weekly average.
export function computeThisWeek(
  dailyRows: DailyRow[],
  rankMoves: RankMove[],
  finishesCount: number,
  today: string,
  pagesPerDay: number
): ThisWeek | null {
  const byDate = new Map(dailyRows.map((r) => [r.date, r.pages]));
  let pagesThisWeek = 0;
  for (let d = addIsoDays(today, -6); d <= today; d = addIsoDays(d, 1)) {
    pagesThisWeek += byDate.get(d) ?? 0;
  }

  if (rankMoves.length === 0 && finishesCount === 0 && pagesThisWeek === 0) return null;

  return { rankMoves, finishesCount, pagesThisWeek, avgWeekPages: pagesPerDay * 7 };
}
