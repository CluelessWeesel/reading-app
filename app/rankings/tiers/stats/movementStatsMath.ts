import { daysBetweenInclusive } from "@/app/shared/isoDate";
import { TIER_ORDER, monthsAgoIso } from "../movementMath";
import { ALL_TIERS } from "../types";
import type { TierId } from "../types";
import type { TierMoveFull, TierStatBook } from "./types";

export type MoveWithDelta = { move: TierMoveFull; delta: number };

// Same logic as the board's MovementPanel, extracted to a pure function and
// expanded to top 10 (the board only shows 5). Only genuine reclassifications
// (from_tier not null) count -- a book's first entry onto the board isn't a
// "climb." Holding isn't part of the ordinal tier scale at all (it's "not
// yet judged," not the worst possible tier), so a move into or out of it
// isn't a climb or fall either -- it's entering or leaving judgment, and
// including it would always register as the single biggest possible swing
// regardless of the tiers actually involved.
export function computeClimbersFallers(
  moves: TierMoveFull[],
  months: 6 | 12
): { climbers: MoveWithDelta[]; fallers: MoveWithDelta[] } {
  const cutoff = monthsAgoIso(months);
  const inWindow = moves
    .filter((m) => m.from_tier != null && m.from_tier !== "holding" && m.to_tier !== "holding" && m.moved_at >= cutoff)
    .map((m) => ({ move: m, delta: TIER_ORDER[m.to_tier] - TIER_ORDER[m.from_tier as TierId] }));
  return {
    climbers: inWindow.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 10),
    fallers: inWindow.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 10),
  };
}

export type VolatilityEntry = { book_id: number; title: string; cover_url: string | null; moveCount: number };

// "Most-moved" -- every row in tier_moves for a book counts, whether it was
// a genuine reclassification or a fresh first entry, since this is asking
// "how much has this book's board history been in flux" overall.
export function computeVolatility(moves: TierMoveFull[]): VolatilityEntry[] {
  const byBook = new Map<number, VolatilityEntry>();
  for (const m of moves) {
    const entry = byBook.get(m.book_id) ?? { book_id: m.book_id, title: m.title, cover_url: m.cover_url, moveCount: 0 };
    entry.moveCount++;
    byBook.set(m.book_id, entry);
  }
  return Array.from(byBook.values())
    .sort((a, b) => b.moveCount - a.moveCount)
    .slice(0, 10);
}

// % of currently-placed books that have never been genuinely reclassified
// since entering the board (their only tier_moves rows, if any, are all
// from_tier=null first-entry events -- or they have none at all, meaning
// they landed during the opening fill and have sat exactly there since).
export function computeStability(
  moves: TierMoveFull[],
  placedBooks: TierStatBook[]
): { stablePct: number; stableCount: number; total: number } {
  const reclassifiedIds = new Set(moves.filter((m) => m.from_tier != null).map((m) => m.book_id));
  const total = placedBooks.length;
  const stableCount = placedBooks.filter((b) => !reclassifiedIds.has(b.book_id)).length;
  return { stablePct: total > 0 ? (stableCount / total) * 100 : 0, stableCount, total };
}

// Days since a book's most recent tier_moves row, or since book_tiers.placed_at
// if it has none (placed_at never updates on a move -- see page.tsx's
// getPlacedBooks comment -- so for a book with no moves it's also correctly
// "how long has this book been where it is").
export function computeDaysInCurrentTierMap(moves: TierMoveFull[], books: TierStatBook[], today: string): Map<number, number> {
  const lastMoveAt = new Map<number, string>();
  for (const m of moves) {
    const prev = lastMoveAt.get(m.book_id);
    if (!prev || m.moved_at > prev) lastMoveAt.set(m.book_id, m.moved_at);
  }
  const result = new Map<number, number>();
  for (const b of books) {
    const since = lastMoveAt.get(b.book_id) ?? b.placed_at;
    result.set(b.book_id, daysBetweenInclusive(since.slice(0, 10), today));
  }
  return result;
}

export type TierDaysStat = { tier: TierId; avgDays: number | null; count: number };

export function computeAvgTimeInCurrentTier(
  moves: TierMoveFull[],
  books: TierStatBook[],
  today: string
): { overallAvgDays: number | null; perTier: TierDaysStat[] } {
  const daysMap = computeDaysInCurrentTierMap(moves, books, today);
  const allDays = Array.from(daysMap.values());
  const overallAvgDays = allDays.length > 0 ? allDays.reduce((a, b) => a + b, 0) / allDays.length : null;

  const perTier: TierDaysStat[] = ALL_TIERS.map((tier) => {
    const tierBooks = books.filter((b) => b.tier === tier);
    const days = tierBooks.map((b) => daysMap.get(b.book_id)).filter((d): d is number => d != null);
    return { tier, avgDays: days.length > 0 ? days.reduce((a, b) => a + b, 0) / days.length : null, count: tierBooks.length };
  });

  return { overallAvgDays, perTier };
}

export type Eviction = {
  evictedBookId: number;
  evictedTitle: string;
  evictedCoverUrl: string | null;
  fromTier: TierId;
  toTier: TierId;
  displacedByBookId: number;
  displacedByTitle: string;
  movedAt: string;
};

// Heuristic: a capacity-forced swap writes two tier_moves rows in the same
// DB transaction (see app/api/tier-board/place/route.ts), and Postgres's
// now() is constant for the whole transaction -- so the displaced book's
// row and the entering book's row share an identical moved_at. Within a
// timestamp group, the displaced book's from_tier equals the entrant's
// to_tier. There's no stored "forced"/"evicted" flag, so this is inferred
// rather than read directly -- documented here since it's the one place
// this plan leans on transactional timing instead of a schema column.
export function computeEvictions(moves: TierMoveFull[]): Eviction[] {
  const byTimestamp = new Map<string, TierMoveFull[]>();
  for (const m of moves) {
    const list = byTimestamp.get(m.moved_at) ?? [];
    list.push(m);
    byTimestamp.set(m.moved_at, list);
  }

  const evictions: Eviction[] = [];
  for (const group of byTimestamp.values()) {
    if (group.length < 2) continue;
    for (const displaced of group) {
      if (displaced.from_tier !== "S" && displaced.from_tier !== "A") continue;
      const entrant = group.find((m) => m.book_id !== displaced.book_id && m.to_tier === displaced.from_tier);
      if (!entrant) continue;
      evictions.push({
        evictedBookId: displaced.book_id,
        evictedTitle: displaced.title,
        evictedCoverUrl: displaced.cover_url,
        fromTier: displaced.from_tier,
        toTier: displaced.to_tier,
        displacedByBookId: entrant.book_id,
        displacedByTitle: entrant.title,
        movedAt: displaced.moved_at,
      });
    }
  }
  return evictions.sort((a, b) => (a.movedAt < b.movedAt ? 1 : -1));
}

// involvesHolding flags an entry as neutral (entering/leaving judgment, not
// a climb or fall) rather than deriving a delta off Holding's ordinal
// position -- Holding isn't part of the tier scale, so "S -> Holding"
// shouldn't read as a bigger fall than "S -> F" just because holding sits
// below F in TIER_ORDER's own internal bookkeeping.
export type FlowEntry = { fromTier: TierId; toTier: TierId; count: number; delta: number; involvesHolding: boolean };

export function computeNetFlow(moves: TierMoveFull[]): FlowEntry[] {
  const counts = new Map<string, { fromTier: TierId; toTier: TierId; count: number }>();
  for (const m of moves) {
    if (m.from_tier == null) continue;
    const key = `${m.from_tier}>${m.to_tier}`;
    const entry = counts.get(key) ?? { fromTier: m.from_tier, toTier: m.to_tier, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  return Array.from(counts.values())
    .map((e) => {
      const involvesHolding = e.fromTier === "holding" || e.toTier === "holding";
      return { ...e, delta: involvesHolding ? 0 : TIER_ORDER[e.toTier] - TIER_ORDER[e.fromTier], involvesHolding };
    })
    .sort((a, b) => b.count - a.count);
}
