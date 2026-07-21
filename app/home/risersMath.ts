import { computeFlatLeaderboards } from "../stats/leaderboardMath";
import type { MetricKey } from "../stats/leaderboardMath";
import type { BookSummary } from "../stats/types";

export type Riser = { author: string; authorId: number | null; rankNow: number; rankBefore: number };

function rankOf(name: string, list: { name: string }[]): number | null {
  const idx = list.findIndex((e) => e.name === name);
  return idx === -1 ? null : idx + 1; // 1-indexed position, not percentile
}

// General "who climbed the leaderboard between two points in time" --
// used both for the pages board (a sliding N-months-ago cutoff) and the
// yearly avgPercentile/"Consistency" board (a hard year-boundary cutoff).
// Tracks actual rank *position* (#15 -> #8), not a percentile score -- an
// author absent from the "before" list entirely isn't a climber in the
// comparative sense this is after, so they're excluded rather than
// treated as climbing from last place.
export function computeRisersForMetric(
  books: BookSummary[],
  authorIdMap: Map<string, number>,
  beforeCutoff: string,
  metric: MetricKey,
  topN = 3
): Riser[] | null {
  // Both snapshots are finished-books-only -- a currently-reading book
  // already has a real page_count from its metadata despite not being
  // finished yet, so leaving it in "now" let an in-progress book's full
  // length silently count toward its author's total (confirmed: showed an
  // author as "risen" purely from a book they hadn't actually finished).
  const finished = books.filter((b) => b.date_finished != null);
  const now = computeFlatLeaderboards(finished, (b) => b.author, 1)[metric];
  const before = computeFlatLeaderboards(
    finished.filter((b) => (b.date_finished as string) <= beforeCutoff),
    (b) => b.author,
    1
  )[metric];

  if (before.length < 2 || now.length < 2) return null;

  const risers: Riser[] = [];
  for (const entry of now) {
    const rankBefore = rankOf(entry.name, before);
    if (rankBefore == null) continue;
    const rankNow = rankOf(entry.name, now) as number;
    if (rankNow >= rankBefore) continue; // no climb (or fell/stayed)
    risers.push({ author: entry.name, authorId: authorIdMap.get(entry.name) ?? null, rankNow, rankBefore });
  }

  const climb = (r: Riser) => r.rankBefore - r.rankNow;
  risers.sort((a, b) => climb(b) - climb(a));
  return risers.length > 0 ? risers.slice(0, topN) : null;
}

export type Mover = Riser & { kind: "winner" | "loser" };

// The yearly avgPercentile/"Consistency" comparison, unlike the pages-based
// Risers above, doesn't hide itself when nobody climbed -- an author board
// with 78+ entries and only ~13 movers a year genuinely can have zero real
// winners (confirmed live: every mover in 2026 so far has fallen), so this
// backfills up to `count` slots with the biggest fallers instead of just
// going empty. Ties are broken the same way in both directions: biggest
// climb first for winners, biggest fall first for losers.
export function computeWinnersAndLosers(
  books: BookSummary[],
  authorIdMap: Map<string, number>,
  beforeCutoff: string,
  metric: MetricKey,
  count = 4
): Mover[] | null {
  // See computeRisersForMetric above -- both snapshots are finished-books-
  // only, so a currently-reading book can't count toward its author before
  // it's actually done.
  const finished = books.filter((b) => b.date_finished != null);
  const now = computeFlatLeaderboards(finished, (b) => b.author, 1)[metric];
  const before = computeFlatLeaderboards(
    finished.filter((b) => (b.date_finished as string) <= beforeCutoff),
    (b) => b.author,
    1
  )[metric];

  if (before.length < 2 || now.length < 2) return null;

  const movers: Riser[] = [];
  for (const entry of now) {
    const rankBefore = rankOf(entry.name, before);
    if (rankBefore == null) continue;
    const rankNow = rankOf(entry.name, now) as number;
    if (rankNow === rankBefore) continue; // no change
    movers.push({ author: entry.name, authorId: authorIdMap.get(entry.name) ?? null, rankNow, rankBefore });
  }
  if (movers.length === 0) return null;

  const climb = (r: Riser) => r.rankBefore - r.rankNow;
  const winners = movers.filter((m) => climb(m) > 0).sort((a, b) => climb(b) - climb(a));
  const losers = movers.filter((m) => climb(m) < 0).sort((a, b) => climb(a) - climb(b));

  const picked: Mover[] = winners.slice(0, count).map((m) => ({ ...m, kind: "winner" as const }));
  if (picked.length < count) {
    picked.push(...losers.slice(0, count - picked.length).map((m) => ({ ...m, kind: "loser" as const })));
  }
  return picked.length > 0 ? picked : null;
}
