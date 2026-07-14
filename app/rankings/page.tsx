import { pool } from "@/lib/db";
import { getAllBookHonours, getSealedYears } from "../weesels/data";
import { RankingsShell } from "./RankingsShell";
import { getSeriesRankingsData } from "./seriesData";
import { SERIES_LIST_NAMES } from "./types";
import type { RankedRow, UnrankedRow, YearData } from "./types";

export const dynamic = "force-dynamic";

const YEARS = [2023, 2024, 2025, 2026];

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

export default async function RankingsPage() {
  const [data, bookHonours, sealedYears, seriesData, mainSeriesData, subSeriesData] = await Promise.all([
    getRankingsData(),
    getAllBookHonours(),
    getSealedYears(),
    getSeriesRankingsData(SERIES_LIST_NAMES[0]),
    getSeriesRankingsData(SERIES_LIST_NAMES[1]),
    getSeriesRankingsData(SERIES_LIST_NAMES[2]),
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
    />
  );
}
