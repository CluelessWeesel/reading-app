import { daysBetweenInclusive } from "../shared/isoDate";
import type { WidgetAccent } from "./widgets/WidgetCard";

export type GenreSlice = { genre: string; count: number; percent: number; accent: WidgetAccent };

export type GenreDiet = { slices: GenreSlice[]; diagnosis: string };

const SLICE_ACCENTS: WidgetAccent[] = ["blue", "purple", "green", "teal", "amber"];

// Top 5 genres by book count within the window, as proportions of the
// window's total (a 6th-and-beyond "other" bucket isn't shown separately
// -- the bar is a read on your dominant genres, not a complete
// accounting). Returns null with fewer than 2 distinct genres, since a
// "diet" isn't meaningful with only one food group.
export function computeGenreDiet(books: { genre: string | null; date_finished: string | null }[], cutoff: string): GenreDiet | null {
  const counts = new Map<string, number>();
  for (const b of books) {
    if (!b.genre || !b.date_finished || b.date_finished < cutoff) continue;
    counts.set(b.genre, (counts.get(b.genre) ?? 0) + 1);
  }
  if (counts.size < 2) return null;

  const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top5 = sorted.slice(0, 5);

  const slices: GenreSlice[] = top5.map(([genre, count], i) => ({
    genre,
    count,
    percent: (count / total) * 100,
    accent: SLICE_ACCENTS[i],
  }));

  const [topGenre, topCount] = sorted[0];
  const topShare = topCount / total;
  const diagnosis =
    topShare >= 0.5
      ? `Heavy on ${topGenre} this window`
      : topShare >= 0.3
        ? `Leaning ${topGenre}, with a real mix`
        : `A genuinely balanced diet this window`;

  return { slices, diagnosis };
}

export type IdleGenreFact = { genre: string; days: number };

// A random genre from your *whole* reading history (not just the current
// window) and how long it's been since you last finished one -- "idle" in
// the sense of a genre currently sitting untouched, re-rolled per visit
// the same way Stat of the Day is.
export function computeIdleGenreFact(
  books: { genre: string | null; date_finished: string | null }[],
  today: string
): IdleGenreFact | null {
  const lastRead = new Map<string, string>();
  for (const b of books) {
    if (!b.genre || !b.date_finished) continue;
    const current = lastRead.get(b.genre);
    if (!current || b.date_finished > current) lastRead.set(b.genre, b.date_finished);
  }
  const genres = Array.from(lastRead.keys());
  if (genres.length === 0) return null;

  const genre = genres[Math.floor(Math.random() * genres.length)];
  const days = daysBetweenInclusive(lastRead.get(genre) as string, today) - 1;
  return { genre, days };
}
