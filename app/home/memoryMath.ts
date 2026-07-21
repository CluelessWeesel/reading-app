export type MemoryPen = {
  bookId: number;
  title: string;
  author: string | null;
  dateFinished: string;
  question: string | null; // null when the pick is a review, not a prompt answer
  text: string;
};

const MAX_CHARS = 280;

export function excerpt(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > MAX_CHARS ? `${trimmed.slice(0, MAX_CHARS).trimEnd()}…` : trimmed;
}

export type OnThisDayEntry = { bookId: number; title: string; year: number };

export type Anniversary = { bookId: number; title: string; yearsAgo: number };

// Roughly 223 books over ~3.5 years means an *exact* calendar-day match is
// rare -- most individual days have nothing at all. A small window around
// today makes both widgets reliably non-empty on a typical visit while
// still reading as "around this time of year," not "randomly picked."
const WINDOW_DAYS = 4;
const REF_YEAR = 2000; // a leap year, so the Feb 29 case doesn't need special-casing

function dayOfYearDistance(isoA: string, isoB: string): number {
  const toDayOfYear = (iso: string): number => {
    const [, m, d] = iso.split("-").map(Number);
    return Math.floor((Date.UTC(REF_YEAR, m - 1, d) - Date.UTC(REF_YEAR, 0, 1)) / 86_400_000);
  };
  const diff = Math.abs(toDayOfYear(isoA) - toDayOfYear(isoB));
  return Math.min(diff, 366 - diff); // shorter way around the calendar (Dec 30 vs Jan 2 = 3, not 363)
}

export function computeOnThisDay(
  books: { book_id: number; title: string; date_finished: string | null }[],
  today: string,
  currentYear: number
): OnThisDayEntry[] {
  return books
    .filter(
      (b): b is typeof b & { date_finished: string } =>
        b.date_finished != null &&
        Number(b.date_finished.slice(0, 4)) < currentYear &&
        dayOfYearDistance(b.date_finished, today) <= WINDOW_DAYS
    )
    .map((b) => ({ bookId: b.book_id, title: b.title, year: Number(b.date_finished.slice(0, 4)) }))
    .sort((a, b) => b.year - a.year);
}

export function computeAnniversaries(
  books: { book_id: number; title: string; date_started: string | null }[],
  today: string,
  currentYear: number
): Anniversary[] {
  return books
    .filter(
      (b): b is typeof b & { date_started: string } =>
        b.date_started != null &&
        Number(b.date_started.slice(0, 4)) < currentYear &&
        dayOfYearDistance(b.date_started, today) <= WINDOW_DAYS
    )
    .map((b) => ({ bookId: b.book_id, title: b.title, yearsAgo: currentYear - Number(b.date_started.slice(0, 4)) }))
    .sort((a, b) => a.yearsAgo - b.yearsAgo);
}
