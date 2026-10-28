import type { Capacities, PlaceableTier, TierBoardData } from "./types";
import { ALL_TIERS, PLACEABLE_TIERS } from "./types";

// Capacity is a share of the total number of books on the board, not a
// fixed count. That is what makes the board scale as the library grows.
//
// Rounded up so every tier carries a little permanent headroom instead of
// sitting at exactly 100 percent between whole slot boundaries.
export function capacityFor(percent: number, totalPlacedBooks: number): number {
  return Math.ceil((percent / 100) * totalPlacedBooks);
}

// Every book on the board, Holding included. FillFlow.tsx uses this for
// its progress bar.
export function totalPlacedFromBoard(board: TierBoardData): number {
  return ALL_TIERS.reduce((sum, tier) => sum + board[tier].length, 0);
}

// Now also counts Holding. Before, Holding books were left out, so a full
// board could never grow, because a tier only gains a slot when the total
// goes up and the total only went up when a book was placed. Counting
// Holding means each book you read opens its share of new slots straight
// away. The name is kept so no other file needs to change.
export function totalJudgedFromBoard(board: TierBoardData): number {
  return totalPlacedFromBoard(board);
}

// Works out every placeable tier's capacity together, because the
// guarantee below needs to see all of them at once. Any shortfall is given
// to the tiers with the largest fractional remainder first.
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
