import { daysBetweenInclusive } from "@/app/shared/isoDate";
import type { RecordResult } from "@/app/stats/recordsMath";
import { TIER_ORDER } from "../movementMath";
import { PLACEABLE_TIERS } from "../types";
import type { TierId } from "../types";
import { tierLabel } from "../tierColors";
import { computeEvictions } from "./movementStatsMath";
import type { TierMoveFull, TierStatBook } from "./types";

const NO: RecordResult = { ok: false };

function bookResult(book: TierStatBook, value: string, when?: string): RecordResult {
  return { ok: true, holder: book.title, holderHref: `/books/${book.book_id}`, value, when };
}

// The most recent event that put a book into its current tier -- either its
// last tier_moves row (any kind), or placed_at if it's never moved (landed
// there during the opening fill and stayed).
function enteredCurrentTierAt(book: TierStatBook, moves: TierMoveFull[]): string {
  const bookMoves = moves.filter((m) => m.book_id === book.book_id);
  return bookMoves.length > 0 ? bookMoves[bookMoves.length - 1].moved_at : book.placed_at;
}

export function longestServingS(books: TierStatBook[], moves: TierMoveFull[], today: string): RecordResult {
  const sBooks = books.filter((b) => b.tier === "S");
  if (sBooks.length === 0) return NO;
  const withSince = sBooks.map((b) => ({ book: b, since: enteredCurrentTierAt(b, moves) }));
  const oldest = withSince.reduce((a, b) => (b.since < a.since ? b : a));
  const days = daysBetweenInclusive(oldest.since.slice(0, 10), today);
  return bookResult(oldest.book, `${days} days in S`, oldest.since.slice(0, 10));
}

// Biggest single-move jump, not a cumulative climb across several moves.
// Holding is excluded on both ends -- it isn't part of the tier scale, so
// "Holding -> S" shouldn't win this by default just because holding sits
// below every real tier in TIER_ORDER's own bookkeeping.
export function fastestRiser(moves: TierMoveFull[]): RecordResult {
  const reclassifications = moves.filter((m) => m.from_tier != null && m.from_tier !== "holding" && m.to_tier !== "holding");
  if (reclassifications.length === 0) return NO;
  const withDelta = reclassifications.map((m) => ({
    move: m,
    delta: TIER_ORDER[m.to_tier] - TIER_ORDER[m.from_tier as TierId],
  }));
  const best = withDelta.reduce((a, b) => (b.delta > a.delta ? b : a));
  if (best.delta <= 0) return NO;
  return {
    ok: true,
    holder: best.move.title,
    holderHref: `/books/${best.move.book_id}`,
    value: `${tierLabel(best.move.from_tier as TierId)} → ${tierLabel(best.move.to_tier)} (+${best.delta})`,
    when: best.move.moved_at.slice(0, 10),
  };
}

// A book whose distinct set of tiers ever visited (from_tier ∪ to_tier
// across its whole history, including its first entry) covers all seven
// placeable tiers -- almost certainly returns "not enough data yet" in
// practice, which RecordCard already renders gracefully.
export function heldEveryTier(moves: TierMoveFull[]): RecordResult {
  const tiersByBook = new Map<number, Set<TierId>>();
  for (const m of moves) {
    const set = tiersByBook.get(m.book_id) ?? new Set<TierId>();
    if (m.from_tier) set.add(m.from_tier);
    set.add(m.to_tier);
    tiersByBook.set(m.book_id, set);
  }
  for (const [bookId, tiers] of tiersByBook) {
    if (!PLACEABLE_TIERS.every((t) => tiers.has(t))) continue;
    const move = moves.find((m) => m.book_id === bookId);
    if (!move) continue;
    return { ok: true, holder: move.title, holderHref: `/books/${bookId}`, value: "visited every placeable tier" };
  }
  return NO;
}

export function mostRecentEviction(moves: TierMoveFull[]): RecordResult {
  const evictions = computeEvictions(moves);
  if (evictions.length === 0) return NO;
  const e = evictions[0];
  return {
    ok: true,
    holder: e.evictedTitle,
    holderHref: `/books/${e.evictedBookId}`,
    value: `${tierLabel(e.fromTier)} → ${tierLabel(e.toTier)}`,
    when: e.movedAt.slice(0, 10),
  };
}

export function highestScoredInHolding(books: TierStatBook[]): RecordResult {
  const holding = books.filter((b) => b.tier === "holding" && b.score != null);
  if (holding.length === 0) return NO;
  const best = holding.reduce((a, b) => ((b.score as number) > (a.score as number) ? b : a));
  return bookResult(best, (best.score as number).toFixed(2));
}
