import { FORMAT_LABELS } from "@/app/shared/formatLabels";
import { TIER_ORDER } from "../movementMath";
import { PLACEABLE_TIERS } from "../types";
import type { SeriesParent, TierStatBook } from "./types";

// Reverse of TIER_ORDER's F=1...S=7 mapping, for displaying an averaged
// ordinal back as a nearest tier letter (e.g. avg 5.3 -> "B").
const ORDINAL_TO_TIER = [...PLACEABLE_TIERS].reverse();

export function tierOrdinalLabel(ordinal: number): string {
  const idx = Math.max(0, Math.min(ORDINAL_TO_TIER.length - 1, Math.round(ordinal) - 1));
  return ORDINAL_TO_TIER[idx];
}

export type TierGroup = {
  key: string;
  label: string;
  // Excludes Holding books -- Holding is "not yet judged," not a bad tier,
  // so folding it into the average would conflate the two. Holding books
  // still appear in `books` for the drill-down list.
  avgTierOrdinal: number | null;
  sCount: number;
  books: TierStatBook[];
};

function makeGroup(key: string, label: string): TierGroup {
  return { key, label, avgTierOrdinal: null, sCount: 0, books: [] };
}

function finalizeGroup(group: TierGroup): void {
  const judged = group.books.filter((b) => b.tier !== "holding");
  group.avgTierOrdinal = judged.length > 0 ? judged.reduce((sum, b) => sum + TIER_ORDER[b.tier], 0) / judged.length : null;
  group.sCount = group.books.filter((b) => b.tier === "S").length;
}

function sortByAvgTierDesc(groups: TierGroup[]): TierGroup[] {
  return [...groups].sort((a, b) => (b.avgTierOrdinal ?? -1) - (a.avgTierOrdinal ?? -1));
}

export function groupByAuthor(books: TierStatBook[], minBooks = 2): TierGroup[] {
  const byKey = new Map<string, TierGroup>();
  for (const b of books) {
    if (!b.author) continue;
    const key = b.author_id != null ? `id:${b.author_id}` : `name:${b.author}`;
    if (!byKey.has(key)) byKey.set(key, makeGroup(key, b.author));
    byKey.get(key)!.books.push(b);
  }
  const groups = Array.from(byKey.values()).filter((g) => g.books.length >= minBooks);
  groups.forEach(finalizeGroup);
  return sortByAvgTierDesc(groups);
}

// A book is tagged with the specific sub-series it belongs to, and the
// `series` table's parent_series chain can run multiple levels deep (e.g.
// Cosmere -> Mistborn -> Mistborn Era 1/2). Grouping by each book's ROOT
// series (walking parent_series all the way up) rather than pre-aggregating
// by every name in the chain avoids double-counting a book at both its own
// level and its parent's -- same real-world hierarchy as
// app/rankings/seriesData.ts, computed in-memory here since the full book
// list is already loaded for the other five dimensions.
function buildRootResolver(seriesParents: SeriesParent[]): (name: string) => string {
  const parentOf = new Map(seriesParents.map((s) => [s.series, s.parent_series]));
  return function rootOf(name: string): string {
    let current = name;
    const visited = new Set<string>([current]);
    for (;;) {
      const parent = parentOf.get(current);
      if (!parent || visited.has(parent)) return current;
      visited.add(parent);
      current = parent;
    }
  };
}

export function groupBySeries(books: TierStatBook[], seriesParents: SeriesParent[], minBooks = 2): TierGroup[] {
  const rootOf = buildRootResolver(seriesParents);
  const byKey = new Map<string, TierGroup>();
  for (const b of books) {
    if (!b.series) continue;
    const root = rootOf(b.series);
    if (!byKey.has(root)) byKey.set(root, makeGroup(root, root));
    byKey.get(root)!.books.push(b);
  }
  const groups = Array.from(byKey.values()).filter((g) => g.books.length >= minBooks);
  groups.forEach(finalizeGroup);
  return sortByAvgTierDesc(groups);
}

export function groupByGenre(books: TierStatBook[], minBooks = 2): TierGroup[] {
  const byKey = new Map<string, TierGroup>();
  for (const b of books) {
    if (!b.genre) continue;
    if (!byKey.has(b.genre)) byKey.set(b.genre, makeGroup(b.genre, b.genre));
    byKey.get(b.genre)!.books.push(b);
  }
  const groups = Array.from(byKey.values()).filter((g) => g.books.length >= minBooks);
  groups.forEach(finalizeGroup);
  return sortByAvgTierDesc(groups);
}

export function groupByFormat(books: TierStatBook[], minBooks = 2): TierGroup[] {
  const byKey = new Map<string, TierGroup>();
  for (const b of books) {
    if (!b.format_type) continue;
    const label = FORMAT_LABELS[b.format_type] ?? b.format_type;
    if (!byKey.has(b.format_type)) byKey.set(b.format_type, makeGroup(b.format_type, label));
    byKey.get(b.format_type)!.books.push(b);
  }
  const groups = Array.from(byKey.values()).filter((g) => g.books.length >= minBooks);
  groups.forEach(finalizeGroup);
  return sortByAvgTierDesc(groups);
}

export function groupByDecade(books: TierStatBook[]): TierGroup[] {
  const byKey = new Map<string, TierGroup>();
  for (const b of books) {
    if (b.year_released == null) continue;
    const decade = Math.floor(b.year_released / 10) * 10;
    const key = String(decade);
    if (!byKey.has(key)) byKey.set(key, makeGroup(key, `${decade}s`));
    byKey.get(key)!.books.push(b);
  }
  const groups = Array.from(byKey.values());
  groups.forEach(finalizeGroup);
  return groups.sort((a, b) => Number(a.key) - Number(b.key));
}

// "Your years, judged from today" -- re-ranks reading years by present-day
// tier judgment rather than the scores given contemporaneously, so a year
// that felt mediocre at the time can read differently once taste settles.
export function groupByYearRead(books: TierStatBook[]): TierGroup[] {
  const byKey = new Map<number, TierGroup>();
  for (const b of books) {
    if (!byKey.has(b.year_read)) byKey.set(b.year_read, makeGroup(String(b.year_read), String(b.year_read)));
    byKey.get(b.year_read)!.books.push(b);
  }
  const groups = Array.from(byKey.values());
  groups.forEach(finalizeGroup);
  return groups.sort((a, b) => Number(a.key) - Number(b.key));
}
