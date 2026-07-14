import { pool } from "@/lib/db";
import type { SeriesListName, SeriesRankedRow, StatusFlag } from "./types";

// A book is tagged with the specific sub-series it belongs to (e.g. "The
// Hobbit" -> "Middle Earth" directly, but the LOTR trilogy -> "Lord of the
// Rings", a child of "Middle Earth" in the `series` table's parent_series
// hierarchy) -- so "Middle Earth"'s own count needs to include every
// descendant series' books too, not just books tagged with that exact name.
async function getSeriesChildrenMap(): Promise<Map<string, string[]>> {
  const { rows } = await pool.query<{ series: string; parent_series: string }>(
    `select series, parent_series from series where parent_series is not null`
  );
  const childrenOf = new Map<string, string[]>();
  for (const r of rows) {
    const list = childrenOf.get(r.parent_series) ?? [];
    list.push(r.series);
    childrenOf.set(r.parent_series, list);
  }
  return childrenOf;
}

// All descendants (children, grandchildren, ...), not just direct children
// -- e.g. Cosmere -> Mistborn -> Mistborn Era 1/2 is a real 2-level chain in
// the live data. Visited-set guards against a cycle, since parent_series has
// no DB constraint preventing one.
function descendantsOf(name: string, childrenOf: Map<string, string[]>): string[] {
  const result: string[] = [];
  const visited = new Set<string>([name]);
  const stack = [...(childrenOf.get(name) ?? [])];
  while (stack.length > 0) {
    const next = stack.pop()!;
    if (visited.has(next)) continue;
    visited.add(next);
    result.push(next);
    stack.push(...(childrenOf.get(next) ?? []));
  }
  return result;
}

type SeriesStats = { books_read: number; score_sum: number; score_count: number };

// Per-name stats for every series a book is tagged with -- kept as
// sum/count (not a pre-averaged value) so a rollup across a family of
// series names can be combined into one correct weighted average rather
// than an average-of-averages.
async function getAllSeriesBookStats(): Promise<Map<string, SeriesStats>> {
  const { rows } = await pool.query<{ series: string; books_read: number; score_count: number; score_sum: number }>(
    `select series,
            count(*) filter (where status is distinct from 'reading')::int as books_read,
            count(score) filter (where status is distinct from 'reading')::int as score_count,
            coalesce(sum(score) filter (where status is distinct from 'reading'), 0)::float8 as score_sum
     from books
     where series is not null
     group by series`
  );
  return new Map(rows.map((r) => [r.series, { books_read: r.books_read, score_sum: r.score_sum, score_count: r.score_count }]));
}

// "Books read" excludes in-progress reads, matching the convention already
// used for library counts (app/library/page.tsx).
export async function getSeriesRankingsData(listName: SeriesListName): Promise<SeriesRankedRow[]> {
  const { rows } = await pool.query<{ rank: number; series: string; status_flag: StatusFlag }>(
    `select rank, series, status_flag from series_rankings where list_name = $1 order by rank asc`,
    [listName]
  );
  if (rows.length === 0) return [];

  const [childrenOf, statsByName] = await Promise.all([getSeriesChildrenMap(), getAllSeriesBookStats()]);

  return rows.map((r) => {
    const family = [r.series, ...descendantsOf(r.series, childrenOf)];
    let booksRead = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    for (const name of family) {
      const s = statsByName.get(name);
      if (!s) continue;
      booksRead += s.books_read;
      scoreSum += s.score_sum;
      scoreCount += s.score_count;
    }
    return {
      rank: r.rank,
      series: r.series,
      status_flag: r.status_flag,
      books_read: booksRead,
      avg_score: scoreCount > 0 ? scoreSum / scoreCount : null,
    };
  });
}
