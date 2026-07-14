import { daysBetweenInclusive } from "@/app/shared/isoDate";
import type { AuthorBook, RankingInfo } from "./types";

function surnameOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export type Minis = {
  longestBook: AuthorBook | null;
  fastestRead: AuthorBook | null;
  peakRanked: { book: AuthorBook; info: RankingInfo; percentile: number } | null;
  totalDaysInWords: number | null;
  daysSinceLast: { days: number; surname: string } | null;
};

// Each mini is independently gracefully skippable -- a sparse (1-2 book)
// author just ends up with fewer of these, never a broken one.
export function computeMinis(
  books: AuthorBook[],
  rankings: Record<number, RankingInfo>,
  authorName: string,
  today: string
): Minis {
  const withWords = books.filter((b) => b.word_count != null);
  const longestBook = withWords.length > 0 ? withWords.reduce((a, b) => ((b.word_count as number) > (a.word_count as number) ? b : a)) : null;

  const withPace = books.filter((b) => b.avg_pages_per_day != null);
  const fastestRead = withPace.length > 0 ? withPace.reduce((a, b) => ((b.avg_pages_per_day as number) > (a.avg_pages_per_day as number) ? b : a)) : null;

  let peakRanked: Minis["peakRanked"] = null;
  for (const book of books) {
    const info = rankings[book.book_id];
    if (!info) continue;
    const percentile = info.total > 1 ? 1 - (info.rank - 1) / (info.total - 1) : 1;
    if (!peakRanked || percentile > peakRanked.percentile) peakRanked = { book, info, percentile };
  }

  const withDuration = books.filter((b) => b.date_started && b.date_finished);
  const totalDaysInWords =
    withDuration.length > 0
      ? withDuration.reduce((sum, b) => sum + daysBetweenInclusive(b.date_started as string, b.date_finished as string), 0)
      : null;

  const finishedDates = books.filter((b) => b.date_finished).map((b) => b.date_finished as string);
  const daysSinceLast =
    finishedDates.length > 0
      ? { days: daysBetweenInclusive(finishedDates.sort().reverse()[0], today) - 1, surname: surnameOf(authorName) }
      : null;

  return { longestBook, fastestRead, peakRanked, totalDaysInWords, daysSinceLast };
}

export type ScoreArcPoint = { book_id: number; title: string; score: number };

export function computeScoreArc(booksInReadingOrder: AuthorBook[]): ScoreArcPoint[] {
  return booksInReadingOrder
    .filter((b) => b.score != null)
    .map((b) => ({ book_id: b.book_id, title: b.title, score: b.score as number }));
}

export type TimelinePoint = { book_id: number; title: string; date_finished: string };

export function computeTimeline(books: AuthorBook[]): TimelinePoint[] {
  return books
    .filter((b) => b.date_finished)
    .map((b) => ({ book_id: b.book_id, title: b.title, date_finished: b.date_finished as string }));
}
