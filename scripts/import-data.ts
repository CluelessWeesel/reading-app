// Reads data/reading_data_gold.xlsx and loads it into Supabase.
//
// Idempotency strategy: everything runs inside a single transaction that
// deletes all rows (children before parents, to respect foreign keys) and
// re-inserts everything fresh from the spreadsheet. Re-running this script
// always leaves Supabase matching exactly what's in the spreadsheet right
// now -- including rows you've deleted, reordered, or edited since the last
// run. Nothing else writes to these tables, so a full refresh is safe.
//
// Usage: npm run import:data

import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import * as XLSX from "xlsx";

const XLSX_PATH = path.join(process.cwd(), "data", "reading_data_gold.xlsx");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local (Supabase dashboard -> Settings -> Database -> Connection string -> URI)."
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---- helpers -----------------------------------------------------------

function nullify(v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  if (typeof v === "number" && Number.isNaN(v)) return null;
  return v;
}

function toInt(v: unknown): number | null {
  const n = nullify(v);
  return n === null ? null : Math.trunc(Number(n));
}

function toFloat(v: unknown): number | null {
  const n = nullify(v);
  return n === null ? null : Number(n);
}

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === "TRUE" || v === "true";
}

function toDateStr(v: unknown): string | null {
  const n = nullify(v);
  if (n === null) return null;
  if (n instanceof Date) {
    const y = n.getUTCFullYear();
    const m = String(n.getUTCMonth() + 1).padStart(2, "0");
    const d = String(n.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(n);
}

function toText(v: unknown): string | null {
  const n = nullify(v);
  return n === null ? null : String(n);
}

// Normalizes a title for matching: trims, lowercases, drops a trailing
// period, collapses whitespace, and treats a leading "the " as optional.
function normalizeTitle(t: string): string {
  return t
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/\s+/g, " ")
    .replace(/^the\s+/, "");
}

function sheetRows<T = Record<string, unknown>>(
  workbook: XLSX.WorkBook,
  name: string
): T[] {
  const sheet = workbook.Sheets[name];
  if (!sheet) throw new Error(`Sheet not found: ${name}`);
  return XLSX.utils.sheet_to_json<T>(sheet, { defval: null });
}

// ---- main ---------------------------------------------------------------

async function main() {
  const buf = readFileSync(XLSX_PATH);
  const workbook = XLSX.read(buf, { cellDates: true });

  const books = sheetRows(workbook, "books");
  const series = sheetRows(workbook, "Series");
  const ratingCategories = sheetRows(workbook, "rating_categories");
  const ratingTemplates = sheetRows(workbook, "rating_templates");
  const genres = sheetRows(workbook, "genres");
  const dailyReading = sheetRows(workbook, "daily_reading");
  const bookRankings = sheetRows(workbook, "book_rankings");
  const seriesRankings = sheetRows(workbook, "series_rankings");
  const weesels = sheetRows(workbook, "weesels");
  const tbr = sheetRows(workbook, "tbr");
  const ramblerReviews = sheetRows(workbook, "rambler_reviews");
  const currentBooks = sheetRows(workbook, "current_books");

  // Build a normalized-title -> book_id lookup for resolving book_rankings.
  const titleToBookId = new Map<string, number>();
  for (const b of books) {
    titleToBookId.set(normalizeTitle(String(b.title)), Number(b.book_id));
  }
  const unmatchedTitles: string[] = [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Delete children before parents.
    await client.query("DELETE FROM book_rankings");
    await client.query("DELETE FROM rating_templates");
    await client.query("DELETE FROM books");
    await client.query("DELETE FROM tbr");
    await client.query("DELETE FROM series_rankings");
    await client.query("DELETE FROM daily_reading");
    await client.query("DELETE FROM weesels");
    await client.query("DELETE FROM rambler_reviews");
    await client.query("DELETE FROM current_books");
    await client.query("DELETE FROM series");
    await client.query("DELETE FROM genres");
    await client.query("DELETE FROM rating_categories");

    // Insert parents before children.
    for (const r of ratingCategories) {
      await client.query(
        `INSERT INTO rating_categories (category, scope) VALUES ($1, $2)`,
        [toText(r.category), toText(r.scope)]
      );
    }

    for (const r of genres) {
      await client.query(
        `INSERT INTO genres (genre, template) VALUES ($1, $2)`,
        [toText(r.genre), toText(r.template)]
      );
    }

    for (const r of ratingTemplates) {
      await client.query(
        `INSERT INTO rating_templates (template, category) VALUES ($1, $2)`,
        [toText(r.template), toText(r.category)]
      );
    }

    for (const r of series) {
      await client.query(
        `INSERT INTO series (series, parent_series) VALUES ($1, $2)`,
        [toText(r.series), toText(r.parent_series)]
      );
    }

    for (const r of books) {
      await client.query(
        `INSERT INTO books (
           book_id, title, author, series, series_number, genre, year_released,
           year_read, score, format_raw, word_count, page_count, format_type,
           narrator, reread, date_started, date_finished, isbn, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          toInt(r.book_id),
          toText(r.title),
          toText(r.author),
          toText(r.series),
          toFloat(r.series_number),
          toText(r.genre),
          toInt(r.year_released),
          toInt(r.year_read),
          toFloat(r.score),
          toText(r.format_raw),
          toFloat(r.word_count),
          toInt(r.page_count),
          toText(r.format_type),
          toText(r.narrator),
          toBool(r.reread),
          toDateStr(r.date_started),
          toDateStr(r.date_finished),
          toText(r.isbn),
          toText(r.status),
        ]
      );
    }

    for (const r of bookRankings) {
      const title = String(r.title);
      const bookId = titleToBookId.get(normalizeTitle(title)) ?? null;
      if (bookId === null) unmatchedTitles.push(title);

      await client.query(
        `INSERT INTO book_rankings (list_id, rank, title, book_id, score, had_star, year)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          toText(r.list_id),
          toInt(r.rank),
          title,
          bookId,
          toFloat(r.score),
          toBool(r.had_star),
          toInt(r.year),
        ]
      );
    }

    for (const r of seriesRankings) {
      await client.query(
        `INSERT INTO series_rankings (list_name, rank, series, status_flag)
         VALUES ($1,$2,$3,$4)`,
        [toText(r.list_name), toFloat(r.rank), toText(r.series), toText(r.status_flag)]
      );
    }

    for (const r of dailyReading) {
      await client.query(
        `INSERT INTO daily_reading (date, pages) VALUES ($1, $2)`,
        [toDateStr(r.date), toInt(r.pages)]
      );
    }

    for (const r of weesels) {
      await client.query(
        `INSERT INTO weesels (year, category, nominee, author_or_narrator, result)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          toInt(r.year),
          toText(r.category),
          toText(r.nominee),
          toText(r.author_or_narrator),
          toText(r.result),
        ]
      );
    }

    for (const r of tbr) {
      await client.query(
        `INSERT INTO tbr (title, owned_or_format, word_count, subgenre, genre)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          toText(r.title),
          toText(r.owned_or_format),
          toInt(r.word_count),
          toText(r.subgenre),
          toText(r.genre),
        ]
      );
    }

    for (const r of ramblerReviews) {
      await client.query(
        `INSERT INTO rambler_reviews (review_subject, category, score, commentary)
         VALUES ($1,$2,$3,$4)`,
        [toText(r.review_subject), toText(r.category), toFloat(r.score), toText(r.commentary)]
      );
    }

    for (const r of currentBooks) {
      await client.query(
        `INSERT INTO current_books (title, format_type, position, started)
         VALUES ($1,$2,$3,$4)`,
        [toText(r.title), toText(r.format_type), toText(r.position), toDateStr(r.started)]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(
    `Imported: ${books.length} books, ${bookRankings.length} book_rankings, ` +
      `${seriesRankings.length} series_rankings, ${dailyReading.length} daily_reading, ` +
      `${weesels.length} weesels, ${tbr.length} tbr, ${ramblerReviews.length} rambler_reviews, ` +
      `${currentBooks.length} current_books.`
  );

  if (unmatchedTitles.length > 0) {
    console.warn(
      `\nWARNING: ${unmatchedTitles.length} book_rankings title(s) did not match any book ` +
        `(book_id left NULL for these rows):`
    );
    for (const t of unmatchedTitles) console.warn(`  - ${t}`);
  } else {
    console.log("All book_rankings titles matched a book.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
