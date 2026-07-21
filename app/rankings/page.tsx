import { pool } from "@/lib/db";
import { getAllBookHonours, getSealedYears } from "../weesels/data";
import { todayLocalIso } from "../shared/isoDate";
import { computeAdjustmentWindow } from "../shared/adjustmentWindow";
import { ADJUSTMENT_LIMIT } from "../shared/adjustmentBudget";
import { RankingsShell } from "./RankingsShell";
import { getSeriesRankingsData } from "./seriesData";
import { SERIES_LIST_NAMES } from "./types";
import type { AdjustmentEvent, AdjustmentWindowData, RankedRow, UnrankedRow, YearData } from "./types";

export const dynamic = "force-dynamic";

const YEARS = [2023, 2024, 2025, 2026];

async function getHoldingCount(): Promise<number> {
  const { rows } = await pool.query<{ n: number }>(`select count(*)::int as n from book_tiers where tier = 'holding'`);
  return rows[0].n;
}

async function getRankingsData(): Promise<Record<number, YearData>> {
  const [rankedRes, unrankedRes, movementsRes] = await Promise.all([
    pool.query<RankedRow & { year: number }>(
      `select br.year, br.rank, br.book_id, br.title, br.score::float8 as score, br.had_star,
              b.author, b.author_id::int as author_id, b.cover_url
       from book_rankings br
       left join books b on b.book_id = br.book_id
       where br.year = any($1)
       order by br.year asc, br.rank asc`,
      [YEARS]
    ),
    pool.query<UnrankedRow & { year: number }>(
      `select b.book_id, b.year_read as year, b.title, b.author, b.author_id::int as author_id, b.cover_url, b.score::float8 as score
       from books b
       where b.year_read = any($1)
         and not exists (select 1 from book_rankings br where br.book_id = b.book_id)
       order by b.year_read asc, b.title asc`,
      [YEARS]
    ),
    pool.query<{ book_id: number; year: number; old_rank: number | null; new_rank: number }>(
      `select distinct on (book_id, year) book_id, year, old_rank, new_rank
       from rank_changes
       where year = any($1)
       order by book_id, year, changed_at desc`,
      [YEARS]
    ),
  ]);

  const byYear: Record<number, YearData> = {};
  for (const year of YEARS) byYear[year] = { year, ranked: [], unranked: [], movements: {} };

  for (const row of rankedRes.rows) byYear[row.year]?.ranked.push(row);
  for (const row of unrankedRes.rows) byYear[row.year]?.unranked.push(row);
  for (const row of movementsRes.rows) {
    const bucket = byYear[row.year];
    if (bucket) bucket.movements[row.book_id] = { old_rank: row.old_rank, new_rank: row.new_rank };
  }

  return byYear;
}

// The adjustment window's target year is always computeAdjustmentWindow's
// result -- whether that window is currently open (Dec25-Jan31, live/
// editable) or already closed (the rest of the year, read-only summary of
// what was logged). "reason is not null" is what marks a row as an
// adjustment event rather than a plain rank/score edit (see migration 0025).
async function getAdjustmentWindowData(today: string): Promise<AdjustmentWindowData> {
  const { year, isOpen } = computeAdjustmentWindow(today);

  const { rows } = await pool.query<{
    kind: "rank" | "score";
    book_id: number;
    title: string;
    old_val: number | null;
    new_val: number | null;
    reason: string;
    changed_at: string;
  }>(
    `select 'rank' as kind, rc.book_id, b.title, rc.old_rank::numeric as old_val, rc.new_rank::numeric as new_val,
            rc.reason, to_char(rc.changed_at, 'YYYY-MM-DD"T"HH24:MI:SS') as changed_at
     from rank_changes rc
     join books b on b.book_id = rc.book_id
     where rc.year = $1 and rc.reason is not null
     union all
     select 'score' as kind, sc.book_id, b.title, sc.old_score as old_val, sc.new_score as new_val,
            sc.reason, to_char(sc.changed_at, 'YYYY-MM-DD"T"HH24:MI:SS') as changed_at
     from score_changes sc
     join books b on b.book_id = sc.book_id
     where sc.year = $1 and sc.reason is not null
     order by changed_at desc`,
    [year]
  );

  const usedCount = new Set(rows.map((r) => r.book_id)).size;
  return { year, isOpen, usedCount, limit: ADJUSTMENT_LIMIT, events: rows as AdjustmentEvent[] };
}

export default async function RankingsPage() {
  const today = todayLocalIso();
  const [data, bookHonours, sealedYears, seriesData, mainSeriesData, subSeriesData, adjustmentWindow, holdingCount] =
    await Promise.all([
      getRankingsData(),
      getAllBookHonours(),
      getSealedYears(),
      getSeriesRankingsData(SERIES_LIST_NAMES[0]),
      getSeriesRankingsData(SERIES_LIST_NAMES[1]),
      getSeriesRankingsData(SERIES_LIST_NAMES[2]),
      getAdjustmentWindowData(today),
      getHoldingCount(),
    ]);
  const currentYear = new Date().getFullYear();
  const defaultYear = YEARS.includes(currentYear) ? currentYear : YEARS[YEARS.length - 1];

  return (
    <RankingsShell
      bookData={data}
      years={YEARS}
      defaultYear={defaultYear}
      bookHonours={Object.fromEntries(bookHonours)}
      sealedYears={Array.from(sealedYears)}
      seriesData={seriesData}
      mainSeriesData={mainSeriesData}
      subSeriesData={subSeriesData}
      adjustmentWindow={adjustmentWindow}
      holdingCount={holdingCount}
    />
  );
}
