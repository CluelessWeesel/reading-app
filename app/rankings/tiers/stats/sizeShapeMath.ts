import { daysBetweenInclusive } from "@/app/shared/isoDate";
import { PLACEABLE_TIERS } from "../types";
import { tierLabel } from "../tierColors";
import type { TierGroup } from "./dimensionMath";
import type { TierStatBook } from "./types";

// One bucket per placeable tier (Holding excluded -- this section asks
// "does size/pace earn a tier," which only makes sense for tiers that are
// actual judgments). Reuses the TierGroup shape so TierDimensionCard can
// render these exactly like the dimension groupings, just with a different
// valueOf per metric instead of avgTierOrdinal.
export function buildPlaceableTierGroups(books: TierStatBook[]): TierGroup[] {
  return PLACEABLE_TIERS.map((tier) => ({
    key: tier,
    label: tierLabel(tier),
    avgTierOrdinal: null,
    sCount: 0,
    books: books.filter((b) => b.tier === tier),
  }));
}

function mean(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export function avgPages(group: TierGroup): number | null {
  return mean(group.books.map((b) => b.page_count));
}

export function avgWords(group: TierGroup): number | null {
  return mean(group.books.filter((b) => b.word_count != null).map((b) => b.word_count as number));
}

export function avgDaysToFinish(group: TierGroup): number | null {
  const withDates = group.books.filter((b) => b.date_started && b.date_finished);
  return mean(withDates.map((b) => daysBetweenInclusive(b.date_started as string, b.date_finished as string)));
}

export function avgPace(group: TierGroup): number | null {
  return mean(group.books.filter((b) => b.avg_pages_per_day != null).map((b) => b.avg_pages_per_day as number));
}
