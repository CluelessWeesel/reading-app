export type PredictionRow = { bookId: number; title: string; predicted: number; actual: number };

export type PredictionWatch = {
  recent: PredictionRow[];
  seasonAccuracy: number; // mean absolute error this year, in score points
  seasonCount: number;
};

// books here is every finished book this year with BOTH a manual
// predicted_score and a final score -- season accuracy is the mean
// |predicted - actual| across all of them, not just the recent ones shown.
export function computePredictionWatch(
  books: { book_id: number; title: string; predicted_score: number; score: number; date_finished: string }[]
): PredictionWatch | null {
  if (books.length === 0) return null;

  const sorted = [...books].sort((a, b) => (a.date_finished < b.date_finished ? 1 : -1));
  const recent = sorted.slice(0, 3).map((b) => ({
    bookId: b.book_id,
    title: b.title,
    predicted: b.predicted_score,
    actual: b.score,
  }));

  const seasonAccuracy =
    books.reduce((sum, b) => sum + Math.abs(b.predicted_score - b.score), 0) / books.length;

  return { recent, seasonAccuracy, seasonCount: books.length };
}
