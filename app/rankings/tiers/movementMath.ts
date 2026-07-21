import { PLACEABLE_TIERS } from "./types";
import type { TierId } from "./types";

// A simple ordinal so a move's "direction" is comparable across any pair of
// tiers -- Holding sits below F (it's "not yet judged," not a real rank),
// so a move INTO Holding always reads as a fall and a move OUT of it always
// reads as a climb. Derived from PLACEABLE_TIERS (best first) rather than
// hardcoded, so splitting/renaming a tier can't silently drift this out of
// sync with it.
export const TIER_ORDER: Record<TierId, number> = Object.fromEntries([
  ["holding", 0],
  ...[...PLACEABLE_TIERS].reverse().map((tier, i) => [tier, i + 1]),
]) as Record<TierId, number>;

export const MAX_TIER_ORDER = PLACEABLE_TIERS.length;

export function tierDelta(fromTier: TierId, toTier: TierId): number {
  return TIER_ORDER[toTier] - TIER_ORDER[fromTier];
}

export function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}
