import { computeCapacities } from "../tierMath";
import { PLACEABLE_TIERS } from "../types";
import type { Capacities, PlaceableTier } from "../types";
import type { TierStatBook } from "./types";

export type TierFullness = { tier: PlaceableTier; count: number; capacity: number; pctFull: number; full: boolean };

export type BoardAtGlance = {
  tiers: TierFullness[];
  holdingCount: number;
  totalPlaced: number;
  totalFinished: number;
};

export function computeBoardAtGlance(books: TierStatBook[], capacities: Capacities, totalFinished: number): BoardAtGlance {
  const totalPlaced = books.length; // display stat: every book_tiers row, Holding included
  const countByTier = new Map<string, number>();
  for (const b of books) countByTier.set(b.tier, (countByTier.get(b.tier) ?? 0) + 1);
  const holdingCount = countByTier.get("holding") ?? 0;
  // Capacities scale off the judged (non-Holding) total, not the raw
  // placed count -- Holding backlog size shouldn't inflate S-F capacity.
  const totalJudged = totalPlaced - holdingCount;

  const tierCapacities = computeCapacities(capacities, totalJudged);
  const tiers: TierFullness[] = PLACEABLE_TIERS.map((tier) => {
    const count = countByTier.get(tier) ?? 0;
    const capacity = tierCapacities[tier];
    return { tier, count, capacity, pctFull: capacity > 0 ? count / capacity : 0, full: count >= capacity };
  });

  return { tiers, holdingCount, totalPlaced, totalFinished };
}
