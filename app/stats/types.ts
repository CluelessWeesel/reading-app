export type DailyRow = { date: string; pages: number };
// book_id is present whenever the row came through the /log flow (see
// migration 0008) -- that's what makes both the format split (join to
// books.format_type) and per-book records (The Possession) possible.
export type FormatDailyRow = { date: string; pages: number; format_type: string; book_id: number };
export type BookSummary = {
  book_id: number;
  title: string;
  cover_url: string | null;
  year_read: number;
  author: string;
  author_id: number | null;
  series: string | null;
  genre: string | null;
  subgenre: string | null;
  narrator: string | null;
  year_released: number | null;
  page_count: number;
  word_count: number | null;
  score: number | null;
  review: string | null;
  indie: boolean | null;
  format_type: string | null;
  format_raw: string | null;
  date_started: string | null;
  date_finished: string | null;
  avg_pages_per_day: number | null;
  ratingsCount: number;
  promptAnswersCount: number;
  // 1 = best (rank 1 of its year's list), 0 = worst; null if never ranked.
  // Comparable across years unlike a raw rank number, since it accounts for
  // how many books were ranked that year.
  percentile: number | null;
};
export type Goal = { year: number; pages_goal: number };
export type SeriesParent = { series: string; parent_series: string | null };
// word_count looks NOT NULL in the original schema but was relaxed later
// (migration 0003) -- real data has ~274 rows with no word count.
export type TbrEntry = { title: string; author: string | null; word_count: number | null };

export type Scope = { kind: "year"; year: number } | { kind: "all" };

export type ProjectionInfo = { projectedTotal: number; verdict: "on track" | "behind pace" };
export type PastYearVerdict = { finalTotal: number; verdict: "met" | "missed" };

export type FormatStat = { avgPages: number; days: number } | null;

export type ScopeData = {
  scope: Scope;
  start: string;
  end: string;
  totalDays: number;
  series: { date: string; pages: number; cumulative: number }[];
  totalPages: number;
  readingDays: number;
  bestStreak: number;
  currentStreak: number | null;
  booksFinished: number;
  avgBookLength: number | null;
  totalWordsEstimate: number;
  pagesPerDay: number;
  wordsPerDay: number;
  goal: number | null;
  projection: ProjectionInfo | null;
  pastYearVerdict: PastYearVerdict | null;
  formatSplit: { physical: FormatStat; audio: FormatStat; hasSplitData: boolean };
};
