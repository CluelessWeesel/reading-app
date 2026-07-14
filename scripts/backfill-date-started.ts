// Backfills books.date_started from data/Ethan_s_Reading_Spreadsheet__3_.xlsx's
// "Read Books" sheet, which has a per-book "Avg Pages/Day" pace figure this
// app never captured.
//
// For every book with a date_finished: match by normalized title to a Read
// Books row with a usable Avg Pages/Day, compute
//   duration = max(1, round(books.page_count / avgPagesPerDay))
// and set date_started = date_finished - duration days. This OVERWRITES any
// existing date_started (the user asked for this explicitly -- computed
// dates are considered more trustworthy than whatever's there now).
//
// Matching: normalizeTitle only (see scripts/lib/normalizeTitle.ts) -- this
// sheet has no author column to cross-check against, unlike the Goodreads
// CSV sync. Ambiguous matches (either side) are reported, never guessed at.
//
// Usage:
//   npm run backfill:date-started            -- dry run, prints the report
//   npm run backfill:date-started -- --write  -- applies in one transaction

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import * as XLSX from "xlsx";
import { normalizeTitle } from "./lib/normalizeTitle";

config({ path: path.join(process.cwd(), ".env.local") });

const XLSX_PATH = path.join(process.cwd(), "data", "Ethan_s_Reading_Spreadsheet__3_.xlsx");
const SHEET_NAME = "Read Books";
const WRITE = process.argv.includes("--write");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

// User-supplied pace for books where the Read Books sheet has a genuine "-"
// (not a typo, not a matching failure -- confirmed by searching the sheet
// for near-miss spellings and finding none: each of these titles appears
// exactly once, already matched, just with no tracked pace).
const MANUAL_AVG_OVERRIDES: { book_id: number; avg: number }[] = [
  { book_id: 110, avg: 70.5 }, // 1984
  { book_id: 113, avg: 6.5 }, // Fahrenheit 451
  { book_id: 111, avg: 130.3 }, // A Clockwork Orange

  // The rest were "no match" purely because the sheet's title differs --
  // found by searching for near-miss spellings, each confirmed as a single
  // unambiguous row:
  { book_id: 151, avg: 130.25 }, // Of Blood and Fire -> sheet has "Of Fire and Blood" (word order swapped)
  { book_id: 49, avg: 6.53 }, // Iron Gold -> sheet has "Iron Gold¹" (trailing footnote marker)
  { book_id: 68, avg: 40 }, // Assassin's Quest -> sheet has "Assasain's Quest" (typo)
  { book_id: 174, avg: 19.6 }, // Assassin's Apprentice -> sheet has "Assasain's Apprentice" (typo)
  { book_id: 175, avg: 11.57 }, // Royal Assassin -> sheet has "Royal Assasain" (typo)
  { book_id: 157, avg: 83.66 }, // Fatemarked -> sheet has "Fatemarked¹" (trailing footnote marker)
  { book_id: 217, avg: 43.5 }, // The Assassin's Blade -> sheet has "The Assasin's Blade" (typo)
];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

type SheetRow = {
  Title: string;
  "Avg Pages/Day": unknown;
};

type DbBook = {
  book_id: number;
  title: string;
  page_count: number | null;
  date_finished: string | null;
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

// UTC-anchored so this doesn't drift with the machine's local timezone --
// same approach as app/shared/isoDate.ts.
function subtractDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
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
    `select book_id, title, page_count::int as page_count,
            to_char(date_finished, 'YYYY-MM-DD') as date_finished
     from books`
  );
  const booksByNorm = group(
    books.filter((b) => b.date_finished !== null),
    (b) => normalizeTitle(b.title)
  );

  const computed: { book_id: number; title: string; date_finished: string; duration: number; date_started: string; avg: number }[] = [];
  const noMatch: { book_id: number; title: string }[] = [];
  const missingAvg: { book_id: number; title: string }[] = [];
  const missingPageCount: { book_id: number; title: string }[] = [];
  const missingDateFinished: { book_id: number; title: string }[] = [];
  const ambiguous: { title: string; reason: string }[] = [];

  for (const book of books) {
    if (book.date_finished === null) {
      missingDateFinished.push({ book_id: book.book_id, title: book.title });
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
      avg = override.avg;
    } else {
      const sheetMatches = sheetByNorm.get(normTitle) ?? [];
      if (sheetMatches.length === 0) {
        noMatch.push({ book_id: book.book_id, title: book.title });
        continue;
      }

      const validAvgRows = sheetMatches
        .map((r) => ({ row: r, avg: parseAvgPagesPerDay(r["Avg Pages/Day"]) }))
        .filter((r): r is { row: SheetRow; avg: number } => r.avg !== null);

      if (validAvgRows.length === 0) {
        missingAvg.push({ book_id: book.book_id, title: book.title });
        continue;
      }
      if (validAvgRows.length > 1) {
        ambiguous.push({
          title: book.title,
          reason: `${validAvgRows.length} Read Books rows have a usable Avg Pages/Day for this title (values: ${validAvgRows.map((r) => r.avg).join(", ")})`,
        });
        continue;
      }

      avg = validAvgRows[0].avg;
    }

    if (book.page_count == null) {
      missingPageCount.push({ book_id: book.book_id, title: book.title });
      continue;
    }

    const duration = Math.max(1, Math.round(book.page_count / avg));
    const dateStarted = subtractDays(book.date_finished, duration);
    computed.push({
      book_id: book.book_id,
      title: book.title,
      date_finished: book.date_finished,
      duration,
      date_started: dateStarted,
      avg,
    });
  }

  // ---------- Report ----------
  console.log("=".repeat(70));
  console.log(WRITE ? "WRITE MODE -- applying changes" : "DRY RUN -- no changes will be made");
  console.log("=".repeat(70));

  console.log(`\n--- Computed date_started (${computed.length}) ---`);
  for (const c of computed) {
    console.log(
      `  #${c.book_id} ${c.title} -- ${c.date_started} -> ${c.date_finished} (${c.duration}d @ ${c.avg} pg/day)`
    );
  }

  console.log(`\n--- No match in Read Books (${noMatch.length}) ---`);
  for (const n of noMatch) console.log(`  #${n.book_id} ${n.title}`);

  console.log(`\n--- Matched but missing usable Avg Pages/Day (${missingAvg.length}) ---`);
  for (const m of missingAvg) console.log(`  #${m.book_id} ${m.title}`);

  if (missingPageCount.length > 0) {
    console.log(`\n--- Matched but books.page_count is null (${missingPageCount.length}) ---`);
    for (const m of missingPageCount) console.log(`  #${m.book_id} ${m.title}`);
  }

  console.log(`\n--- No date_finished, skipped entirely (${missingDateFinished.length}) ---`);
  for (const m of missingDateFinished) console.log(`  #${m.book_id} ${m.title}`);

  if (ambiguous.length > 0) {
    console.log(`\n--- Ambiguous, skipped (${ambiguous.length}) ---`);
    for (const a of ambiguous) console.log(`  "${a.title}": ${a.reason}`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total books: ${books.length}`);
  console.log(`Computed date_started: ${computed.length}`);
  console.log(`No match: ${noMatch.length}`);
  console.log(`Missing avg: ${missingAvg.length}`);
  console.log(`Missing page_count: ${missingPageCount.length}`);
  console.log(`No date_finished: ${missingDateFinished.length}`);
  console.log(`Ambiguous: ${ambiguous.length}`);

  if (!WRITE) {
    console.log("\nDry run only -- re-run with --write to apply.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const c of computed) {
      await client.query(`update books set date_started = $1 where book_id = $2`, [
        c.date_started,
        c.book_id,
      ]);
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
