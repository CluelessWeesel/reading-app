import { pool } from "@/lib/db";
import { daysBetweenInclusive } from "@/app/shared/isoDate";
import type { Book } from "@/app/shared/bookTypes";
import { ordinal } from "./format";

export type DerivedStat = { label: string; value: string };
export type PaceMetric = { label: string; unit: string; mine: number; avg: number; digits: number };

// Each stat below is skipped outright if its inputs are missing -- adding a
// new one later is just another guarded push() onto `stats`. paceChart only
// gets an entry when there's a real average to compare against (same
// condition the "vs your usual" text already requires), computed alongside
// the text stats so there's no second pass over the same queries.
export async function computeDerivedStats(
  book: Book,
  curatedRanking: { rank: number; total: number; year: number } | null
): Promise<{ stats: DerivedStat[]; paceChart: PaceMetric[] }> {
  const stats: DerivedStat[] = [];
  const paceChart: PaceMetric[] = [];

  if (book.date_started && book.date_finished && book.page_count != null) {
    const days = daysBetweenInclusive(book.date_started, book.date_finished);
    if (days > 0) {
      const pagesPerDay = book.page_count / days;
      const { rows } = await pool.query<{ avg_pace: number | null }>(
        `select avg(page_count::float8 / (date_finished - date_started + 1)) as avg_pace
         from books
         where book_id != $1 and date_started is not null and date_finished is not null
           and date_finished >= date_started and page_count is not null`,
        [book.book_id]
      );
      const avgPace = rows[0]?.avg_pace ?? null;
      stats.push({ label: "Pace", value: paceLine(pagesPerDay, avgPace, "pg/day", 1) });
      if (avgPace != null && avgPace > 0) {
        paceChart.push({ label: "Pages/day", unit: "pg/day", mine: pagesPerDay, avg: avgPace, digits: 1 });
      }

      if (book.word_count != null) {
        const wordsPerDay = book.word_count / days;
        const { rows: wRows } = await pool.query<{ avg_pace: number | null }>(
          `select avg(word_count::float8 / (date_finished - date_started + 1)) as avg_pace
           from books
           where book_id != $1 and date_started is not null and date_finished is not null
             and date_finished >= date_started and word_count is not null`,
          [book.book_id]
        );
        const avgWordPace = wRows[0]?.avg_pace ?? null;
        stats.push({
          label: "Word pace",
          value: paceLine(wordsPerDay, avgWordPace, "words/day", 0),
        });
        if (avgWordPace != null && avgWordPace > 0) {
          paceChart.push({
            label: "Words/day",
            unit: "words/day",
            mine: wordsPerDay,
            avg: avgWordPace,
            digits: 0,
          });
        }
      }
    }
  }

  // Deliberately NOT derived from books.score: many books tie on score (13
  // books tied at 5.0 in one real case), and SQL rank() gives every tied
  // book the same rank -- "1st of 41" for a book that's actually 12th. The
  // curated book_rankings table already resolves ties by hand and is the
  // same data the header's ranking badge uses, so this just restates that
  // in words instead of recomputing a different, sometimes-wrong number.
  if (curatedRanking && curatedRanking.total > 1) {
    stats.push({
      label: "Year context",
      value: `${ordinal(curatedRanking.rank)} of ${curatedRanking.total} read in ${curatedRanking.year}`,
    });
  }

  if (book.author && book.date_finished) {
    const { rows } = await pool.query<{ book_id: number; rnk: string; total: number }>(
      `select book_id, row_number() over (order by date_finished asc, book_id asc) as rnk, count(*) over ()::int as total
       from books where author = $1 and date_finished is not null`,
      [book.author]
    );
    const mine = rows.find((r) => r.book_id === book.book_id);
    if (mine && mine.total > 1) {
      stats.push({ label: "Author context", value: `Your ${ordinal(Number(mine.rnk))} ${book.author} book` });
    }
  }

  // Deliberately NOT derived from books.score, for the same reason as "Year
  // context" above: score ties don't reflect true preference order, and the
  // curated book_rankings position does. Since series-mates can be ranked in
  // different years' lists, ranks aren't directly comparable across books --
  // so each is normalized to a 0-1 percentile within its own year first.
  if (book.series) {
    const { rows } = await pool.query<{ book_id: number; rank: number; total: number }>(
      `select br.book_id, br.rank, cnt.total
       from book_rankings br
       join books b on b.book_id = br.book_id
       join (select list_id, count(*)::int as total from book_rankings group by list_id) cnt
         on cnt.list_id = br.list_id
       where b.series = $1`,
      [book.series]
    );
    const percentileOf = (r: { rank: number; total: number }) =>
      r.total > 1 ? 1 - (r.rank - 1) / (r.total - 1) : 1;
    const mine = rows.find((r) => r.book_id === book.book_id);
    if (mine && rows.length > 1) {
      const percentiles = rows.map(percentileOf);
      const minePercentile = percentileOf(mine);
      const max = Math.max(...percentiles);
      const min = Math.min(...percentiles);
      if (max !== min) {
        const which =
          minePercentile === max
            ? "highest-ranked"
            : minePercentile === min
              ? "lowest-ranked"
              : "middle-ranked";
        stats.push({ label: "Series context", value: `Your ${which} ${book.series} book` });
      }
    }
  }

  return { stats, paceChart };
}

function paceLine(mine: number, avg: number | null, unit: string, digits: number): string {
  const minePart = `${mine.toFixed(digits)} ${unit}`;
  if (avg == null || avg <= 0) return minePart;
  const pctDiff = Math.round(((mine - avg) / avg) * 100);
  const direction = pctDiff >= 0 ? "above" : "below";
  return `${minePart} · ${Math.abs(pctDiff)}% ${direction} your usual`;
}
