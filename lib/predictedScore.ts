import { pool } from "@/lib/db";

export type PredictedScoreResult = {
  score: number;
  margin: number;
  basis: string[];
};

// How many other scored books a signal needs before it's trusted about as
// much as the global average -- below this, its group mean is pulled hard
// toward mu0 (empirical-Bayes shrinkage); above it, the group's own mean
// increasingly dominates.
const SHRINKAGE_K = 5;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

async function groupStat(
  whereClause: string,
  params: unknown[]
): Promise<{ n: number; mean: number | null; sd: number | null }> {
  const { rows } = await pool.query(
    `select count(*)::int as n, avg(score)::float8 as mean, stddev_samp(score)::float8 as sd
     from books where ${whereClause}`,
    params
  );
  return rows[0];
}

type Signal = {
  value: string | null;
  column: "author" | "series" | "narrator" | "genre" | "format_type";
  weight: number;
  describe: (n: number) => string;
};

// Estimates what you'd likely rate this book, purely from OTHER scored books
// (this book itself is always excluded, so it's a genuine out-of-sample
// prediction rather than something that trivially includes its own answer).
// Blends several signals -- author, series, narrator, genre, format, and an
// overall baseline -- each shrunk toward the global mean by how much data
// backs it up, then combined by a fixed specificity weight (how predictive
// that signal type tends to be). The margin reflects both how much the
// signals disagree with each other and how little data underpins them.
// Returns null only if there are no other scored books anywhere to learn from.
export async function computePredictedScore(book: {
  book_id: number;
  author: string | null;
  series: string | null;
  narrator: string | null;
  genre: string | null;
  format_type: string | null;
}): Promise<PredictedScoreResult | null> {
  const overall = await groupStat("book_id != $1 and score is not null", [book.book_id]);
  if (!overall.n || overall.mean == null) return null;

  const mu0 = overall.mean;
  const sigma0 = overall.sd ?? 1;

  const signals: Signal[] = [
    {
      value: book.author,
      column: "author",
      weight: 3,
      describe: (n) => `${n} other book${n === 1 ? "" : "s"} by this author`,
    },
    {
      value: book.series,
      column: "series",
      weight: 3,
      describe: (n) => `${n} other ${book.series} book${n === 1 ? "" : "s"}`,
    },
    {
      value: book.format_type === "audio" ? book.narrator : null,
      column: "narrator",
      weight: 2,
      describe: (n) => `${n} other book${n === 1 ? "" : "s"} narrated by ${book.narrator}`,
    },
    {
      value: book.genre,
      column: "genre",
      weight: 1,
      describe: (n) => `${n} other ${book.genre} book${n === 1 ? "" : "s"}`,
    },
    {
      value: book.format_type,
      column: "format_type",
      weight: 0.5,
      describe: (n) => `${n} other ${book.format_type} book${n === 1 ? "" : "s"}`,
    },
  ];

  const contributions: { weight: number; mean: number; n: number; label: string }[] = [];

  for (const signal of signals) {
    if (!signal.value) continue;
    const stat = await groupStat(`${signal.column} = $2 and book_id != $1 and score is not null`, [
      book.book_id,
      signal.value,
    ]);
    if (!stat.n || stat.mean == null) continue;
    const shrunkMean = (stat.n * stat.mean + SHRINKAGE_K * mu0) / (stat.n + SHRINKAGE_K);
    contributions.push({ weight: signal.weight, mean: shrunkMean, n: stat.n, label: signal.describe(stat.n) });
  }

  // Weak baseline anchor -- keeps the prediction tethered to "your overall
  // average" even when every specific signal above is sparse or absent.
  contributions.push({
    weight: 0.5,
    mean: mu0,
    n: overall.n,
    label: `${overall.n} other scored book${overall.n === 1 ? "" : "s"} overall`,
  });

  const totalWeight = contributions.reduce((sum, c) => sum + c.weight, 0);
  const predicted = contributions.reduce((sum, c) => sum + c.weight * c.mean, 0) / totalWeight;

  const disagreementVariance =
    contributions.reduce((sum, c) => sum + c.weight * (c.mean - predicted) ** 2, 0) / totalWeight;
  const effectiveN = contributions.reduce((sum, c) => sum + c.n, 0);
  const baselineUncertainty = sigma0 / Math.sqrt(Math.max(effectiveN, 1));
  const margin = Math.sqrt(disagreementVariance + baselineUncertainty ** 2);

  return {
    score: Math.round(clamp(predicted, 0.5, 5) * 10) / 10,
    margin: Math.round(clamp(margin, 0.3, 2) * 10) / 10,
    basis: contributions.map((c) => c.label),
  };
}
