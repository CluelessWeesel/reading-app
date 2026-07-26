import type { Capacities, PlaceableTier, TierBoardData } from "./types";
import { ALL_TIERS, PLACEABLE_TIERS } from "./types";

// Capacity is a share of the current judged (non-Holding) placed total --
// not a fixed count. That's what makes the board scale as the library
// grows: S at 224 judged books is 12 slots, S at 500 is 25.
//
// Rounded UP (not half-up) so every tier carries a little permanent
// headroom instead of periodically sitting at hard 100% between whole-slot
// boundaries -- at a 5% share, S only earns another slot once every ~20
// additional judged books, so under half-up rounding it reads as
// completely full for most of that stretch (confirmed live: every one of
// the 7 tiers landed at exactly 100% simultaneously with zero slack,
// forcing a swap for any new entrant regardless of which tier it belonged
// in). Ceiling trades slightly-more-generous-than-literal capacities,
// permanently, for room to actually judge the next book most of the time.
export function capacityFor(percent: number, totalPlacedBooks: number): number {
  return Math.ceil((percent / 100) * totalPlacedBooks);
}

// Includes Holding -- kept for FillFlow.tsx's one-time opening-fill
// ceremony (already completed, historical), which needs "every book that's
// entered the board at all, capped tier or not" as its progress-bar/
// capacity denominator. Steady-state capacity math should use
// totalJudgedFromBoard below instead -- see its own comment for why.
export function totalPlacedFromBoard(board: TierBoardData): number {
  return ALL_TIERS.reduce((sum, tier) => sum + board[tier].length, 0);
}

// Excludes Holding -- Holding is "not yet judged," not part of the judged
// library's size, so it must never inflate every other tier's capacity.
// This is the total every steady-state (post-fill) capacity calculation
// should scale against.
export function totalJudgedFromBoard(board: TierBoardData): number {
  return PLACEABLE_TIERS.reduce((sum, tier) => sum + board[tier].length, 0);
}

// Computes every placeable tier's live capacity together (not one at a
// time) because the guarantee below needs to see all seven at once.
// Ceiling rounding means every tier's capacity already meets or exceeds
// its exact share, so in the common case (percentages summing to 100, as
// they do today) the total already comes out >= `total` on its own -- this
// is a safety net for the uncommon case (e.g. capacity settings edited to
// no longer sum to 100%), still guaranteeing the board can never become
// mathematically unfillable. Any shortfall is handed to the tiers with the
// largest fractional remainder first (largest-remainder/Hamilton
// apportionment), the smallest, fairest correction available.
export function computeCapacities(capacities: Capacities, total: number): Record<PlaceableTier, number> {
  const raw = PLACEABLE_TIERS.map((tier) => {
    const exact = (capacities[tier] / 100) * total;
    return { tier, remainder: exact - Math.floor(exact), rounded: capacityFor(capacities[tier], total) };
  });

  const result = {} as Record<PlaceableTier, number>;
  for (const r of raw) result[r.tier] = r.rounded;

  const shortfall = total - raw.reduce((sum, r) => sum + r.rounded, 0);
  if (shortfall > 0) {
    const byRemainderDesc = [...raw].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < shortfall; i++) {
      result[byRemainderDesc[i % byRemainderDesc.length].tier] += 1;
    }
  }

  return result;
}

export function capacitiesFromBoard(capacities: Capacities, board: TierBoardData): Record<PlaceableTier, number> {
  return computeCapacities(capacities, totalJudgedFromBoard(board));
}

export function isTierFull(tier: PlaceableTier, board: TierBoardData, capacities: Capacities): boolean {
  const capacity = computeCapacities(capacities, totalJudgedFromBoard(board))[tier];
  return board[tier].length >= capacity;
}
