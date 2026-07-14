// Backfills books.avg_pages_per_day from data/Ethan_s_Reading_Spreadsheet__3_.xlsx's
// "Read Books" sheet -- specifically the "Avg Pages/Day Avg Book" column
// (NOT the plain "Avg Pages/Day" column, which divides each book's own
// Words Per Day by *that book's own* Words/Page and so isn't comparable
// across books of different density). "Avg Pages/Day Avg Book" instead
// divides by a single constant -- confirmed as ~306.78 words/page across
// 215 of 217 sampled rows -- i.e. every book's pace expressed as "pages/day
// of an average-density book", which genuinely is comparable book-to-book.
//
// Matching: normalizeTitle only, same as backfill-date-started.ts (this
// sheet has no author column to cross-check against). The manual-override
// books (no sheet data at all) are normalized the same way at write time:
// override_raw_pace * (this book's own word_count/page_count) / AVG_WORDS_PER_PAGE.
//
// Usage:
//   npm run backfill:avg-pace            -- dry run, prints the report
//   npm run backfill:avg-pace -- --write -- applies in one transaction

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import * as XLSX from "xlsx";
import { normalizeTitle } from "./lib/normalizeTitle";
import { AVG_WORDS_PER_PAGE } from "../app/shared/avgPagesPerDay";

config({ path: path.join(process.cwd(), ".env.local") });

const XLSX_PATH = path.join(process.cwd(), "data", "Ethan_s_Reading_Spreadsheet__3_.xlsx");
const SHEET_NAME = "Read Books";
const WRITE = process.argv.includes("--write");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

// AVG_WORDS_PER_PAGE now lives in app/shared/avgPagesPerDay.ts (shared with
// the live finish-book write-path) so the two can never drift apart -- see
// that file's comment for where the constant itself comes from.

// Same book_id list as scripts/backfill-date-started.ts -- these were
// confirmed by hand during that earlier backfill (either a genuine "-" in
// the sheet, or a near-miss spelling found and matched to a single
// unambiguous row). The values here are RAW pages/day (as originally
// recorded, matching that book's own words/page), so they're normalized at
// write time the same way the sheet's own column is -- see
// `normalizeRawPace` below.
const MANUAL_AVG_OVERRIDES: { book_id: number; avg: number }[] = [
  { book_id: 110, avg: 70.5 }, // 1984
  { book_id: 113, avg: 6.5 }, // Fahrenheit 451
  { book_id: 111, avg: 130.3 }, // A Clockwork Orange
  { book_id: 151, avg: 130.25 }, // Of Blood and Fire -> sheet has "Of Fire and Blood"
  { book_id: 49, avg: 6.53 }, // Iron Gold -> sheet has "Iron Gold¹"
  { book_id: 68, avg: 40 }, // Assassin's Quest -> sheet has "Assasain's Quest"
  { book_id: 174, avg: 19.6 }, // Assassin's Apprentice -> sheet has "Assasain's Apprentice"
  { book_id: 175, avg: 11.57 }, // Royal Assassin -> sheet has "Royal Assasain"
  { book_id: 157, avg: 83.66 }, // Fatemarked -> sheet has "Fatemarked¹"
  { book_id: 217, avg: 43.5 }, // The Assassin's Blade -> sheet has "The Assasin's Blade"
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

type SheetRow = { Title: string; "Avg Pages/Day Avg Book": unknown };
type DbBook = {
  book_id: number;
  title: string;
  date_finished: string | null;
  avg_pages_per_day: number | null;
  word_count: number | null;
  page_count: number;
};

function group<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function parseAvgPagesPerDay(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  return null;
}

// Converts a raw (this-book's-own-density) pages/day figure into the same
// average-book-equivalent basis as the sheet's own column, using this
// book's actual word_count/page_count.
function normalizeRawPace(rawPace: number, book: DbBook): number | null {
  if (book.word_count == null || book.page_count <= 0) return null;
  const wordsPerPage = book.word_count / book.page_count;
  return (rawPace * wordsPerPage) / AVG_WORDS_PER_PAGE;
}

async function main() {
  const buf = readFileSync(XLSX_PATH);
  const workbook = XLSX.read(buf, { type: "buffer" });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`Sheet "${SHEET_NAME}" not found. Sheets present: ${workbook.SheetNames.join(", ")}`);
  }
  const rawRows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "", raw: true });
  const sheetRows = rawRows.filter((r) => String(r.Title).trim());
  const sheetByNorm = group(sheetRows, (r) => normalizeTitle(String(r.Title)));

  const { rows: books } = await pool.query<DbBook>(
    `select book_id, title, to_char(date_finished, 'YYYY-MM-DD') as date_finished,
            avg_pages_per_day::float8 as avg_pages_per_day,
            word_count::float8 as word_count, page_count
     from books`
  );
  const booksByNorm = group(
    books.filter((b) => b.date_finished !== null),
    (b) => normalizeTitle(b.title)
  );

  const computed: { book_id: number; title: string; avg: number; changed: boolean }[] = [];
  const noMatch: { book_id: number; title: string }[] = [];
  const missingAvg: { book_id: number; title: string }[] = [];
  const skippedNotFinished: { book_id: number; title: string }[] = [];
  const skippedNoWordCount: { book_id: number; title: string }[] = [];
  const ambiguous: { title: string; reason: string }[] = [];

  for (const book of books) {
    if (book.date_finished === null) {
      skippedNotFinished.push({ book_id: book.book_id, title: book.title });
      continue;
    }

    const normTitle = normalizeTitle(book.title);
    const booksWithThisTitle = booksByNorm.get(normTitle) ?? [];
    if (booksWithThisTitle.length > 1) {
      ambiguous.push({
        title: book.title,
        reason: `${booksWithThisTitle.length} books (with date_finished) share this normalized title -- can't safely tell which Read Books row belongs to which`,
      });
      continue;
    }

    const override = MANUAL_AVG_OVERRIDES.find((o) => o.book_id === book.book_id);
    let avg: number;

    if (override) {
      const normalized = normalizeRawPace(override.avg, book);
      if (normalized === null) {
        skippedNoWordCount.push({ book_id: book.book_id, title: book.title });
        continue;
      }
      avg = normalized;
    } else {
      const sheetMatches = sheetByNorm.get(normTitle) ?? [];
      if (sheetMatches.length === 0) {
        noMatch.push({ book_id: book.book_id, title: book.title });
        continue;
      }

      const validAvgRows = sheetMatches
        .map((r) => ({ row: r, avg: parseAvgPagesPerDay(r["Avg Pages/Day Avg Book"]) }))
        .filter((r): r is { row: SheetRow; avg: number } => r.avg !== null);

      if (validAvgRows.length === 0) {
        missingAvg.push({ book_id: book.book_id, title: book.title });
        continue;
      }
      if (validAvgRows.length > 1) {
        ambiguous.push({
          title: book.title,
          reason: `${validAvgRows.length} Read Books rows have a usable Avg Pages/Day Avg Book for this title (values: ${validAvgRows.map((r) => r.avg).join(", ")})`,
        });
        continue;
      }

      avg = validAvgRows[0].avg;
    }

    const changed = book.avg_pages_per_day == null || Math.abs(book.avg_pages_per_day - avg) > 0.001;
    computed.push({ book_id: book.book_id, title: book.title, avg, changed });
  }

  console.log("=".repeat(70));
  console.log(WRITE ? "WRITE MODE -- applying changes" : "DRY RUN -- no changes will be made");
  console.log("=".repeat(70));

  const toChange = computed.filter((c) => c.changed);
  console.log(`\n--- Will set avg_pages_per_day (${toChange.length} of ${computed.length} matched) ---`);
  for (const c of toChange) console.log(`  #${c.book_id} ${c.title} -- ${c.avg.toFixed(2)} pg/day`);

  console.log(`\n--- No match in Read Books (${noMatch.length}) ---`);
  for (const n of noMatch) console.log(`  #${n.book_id} ${n.title}`);

  console.log(`\n--- Matched but missing usable Avg Pages/Day Avg Book (${missingAvg.length}) ---`);
  for (const m of missingAvg) console.log(`  #${m.book_id} ${m.title}`);

  if (skippedNoWordCount.length > 0) {
    console.log(`\n--- Manual override but no word_count to normalize with (${skippedNoWordCount.length}) ---`);
    for (const s of skippedNoWordCount) console.log(`  #${s.book_id} ${s.title}`);
  }

  if (ambiguous.length > 0) {
    console.log(`\n--- Ambiguous, skipped (${ambiguous.length}) ---`);
    for (const a of ambiguous) console.log(`  "${a.title}": ${a.reason}`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total books: ${books.length}`);
  console.log(`Matched with a pace value: ${computed.length}`);
  console.log(`  ...of which changed: ${toChange.length}`);
  console.log(`No match: ${noMatch.length}`);
  console.log(`Missing avg: ${missingAvg.length}`);
  console.log(`No date_finished, skipped: ${skippedNotFinished.length}`);
  console.log(`Manual override, no word_count: ${skippedNoWordCount.length}`);
  console.log(`Ambiguous: ${ambiguous.length}`);

  if (!WRITE) {
    console.log("\nDry run only -- re-run with --write to apply.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const c of toChange) {
      await client.query(`update books set avg_pages_per_day = $1 where book_id = $2`, [c.avg, c.book_id]);
    }
    await client.query("COMMIT");
    console.log("\nAll changes committed.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
