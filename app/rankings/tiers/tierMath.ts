import type { Capacities, PlaceableTier, TierBoardData } from "./types";
import { ALL_TIERS, PLACEABLE_TIERS } from "./types";

// Capacity is a share of every book currently placed on the board (S-D and
// Holding together, i.e. every book_tiers row) -- not a fixed count. That's
// what makes the board scale as the library grows, and also what makes the
// opening fill's per-tier "slots left" genuinely live: totalPlaced grows by
// one with every book the fill places, so capacity grows right along with it.
export function capacityFor(percent: number, totalPlacedBooks: number): number {
  return Math.round((percent / 100) * totalPlacedBooks);
}

export function totalPlacedFromBoard(board: TierBoardData): number {
  return ALL_TIERS.reduce((sum, tier) => sum + board[tier].length, 0);
}

export function capacitiesFromBoard(capacities: Capacities, board: TierBoardData): Record<PlaceableTier, number> {
  const total = totalPlacedFromBoard(board);
  const result = {} as Record<PlaceableTier, number>;
  for (const tier of PLACEABLE_TIERS) result[tier] = capacityFor(capacities[tier], total);
  return result;
}

export function isTierFull(tier: PlaceableTier, board: TierBoardData, capacities: Capacities): boolean {
  const total = totalPlacedFromBoard(board);
  const capacity = capacityFor(capacities[tier], total);
  return board[tier].length >= capacity;
}
