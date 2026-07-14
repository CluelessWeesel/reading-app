// Words/page averaged across the historical "Avg Pages/Day Avg Book" column
// (215 of 217 sampled rows agree to 4 decimal places -- see
// scripts/backfill-avg-pace.ts). This is a FIXED reference point, not
// something to recompute as new books are added: recomputing it would drift
// over time and make old and new avg_pages_per_day values incomparable,
// defeating the whole point of the metric.
export const AVG_WORDS_PER_PAGE = 306.7802472337319;

// Same "average-book-equivalent pace" basis as the historical column, so a
// book finished today stays comparable to one from years ago -- and so
// audiobooks (whose natural pace is words/day via narration speed) land on
// the same "pages/day" scale as print at all.
export function computeAvgPagesPerDay(wordCount: number | null, daysTaken: number): number | null {
  if (wordCount == null || daysTaken <= 0) return null;
  return wordCount / daysTaken / AVG_WORDS_PER_PAGE;
}
