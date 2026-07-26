// A resolved prediction: a book that had a predicted_score/predicted_margin
// (set back on the TBR, carried onto the book at start) and has since been
// scored for real. Only books with all three present count.
export type ResolvedPrediction = {
  book_id: number;
  predicted_score: number;
  predicted_margin: number;
  score: number;
};

export type PredictionAccuracy = {
  n: number;
  avgAbsError: number;
  hitRate: number; // fraction (0-1) landing within its own stated margin
};

// Confidence scored alongside accuracy, per spec: avgAbsError is "how close
// were the calls" regardless of what margin was claimed; hitRate is "how
// often did the stated margin actually cover the miss" -- a tight margin
// that keeps missing says something different than a wide one that always
// hits.
export function computePredictionAccuracy(resolved: ResolvedPrediction[]): PredictionAccuracy | null {
  if (resolved.length === 0) return null;
  const errors = resolved.map((r) => Math.abs(r.score - r.predicted_score));
  const avgAbsError = errors.reduce((sum, e) => sum + e, 0) / resolved.length;
  const hits = resolved.filter((r) => Math.abs(r.score - r.predicted_score) <= r.predicted_margin).length;
  return { n: resolved.length, avgAbsError, hitRate: hits / resolved.length };
}
