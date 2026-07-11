// Matches data/goodreads_library_export.csv against the books table and
// backfills isbn and date_finished where they're currently NULL.
//
// Matching: titles are normalized the same way scripts/lib/normalizeTitle.ts
// does for the main importer (trim, case-insensitive, strip a trailing
// period, leading "The" optional). Because two different books can share a
// title (e.g. "War" by Bob Woodward vs. "War" by Sebastian Junger both
// appear in this export), a normalized-title match is then cross-checked
// against a normalized author before being accepted. Anything that doesn't
// resolve cleanly is reported, not guessed.
//
// date_started is NOT backfilled: Goodreads' export has no "Date Started"
// column at all (it only tracks a finish date), so there is nothing to pull
// it from.
//
// Usage: npm run backfill:goodreads

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import * as XLSX from "xlsx";
import { normalizeTitle } from "./lib/normalizeTitle";

config({ path: path.join(process.cwd(), ".env.local") });

const CSV_PATH = path.join(process.cwd(), "data", "goodreads_library_export.csv");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local (Supabase dashboard -> Settings -> Database -> Connection string -> URI)."
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

type GoodreadsRow = {
  Title: string;
  Author: string;
  ISBN: string;
  ISBN13: string;
  "Date Read": string;
};

type Candidate = {
  author: string;
  normAuthor: string;
  isbn: string | null;
  dateFinished: string | null;
};

type DbBook = {
  book_id: number;
  title: string;
  author: string;
  isbn: string | null;
  date_finished: string | null;
};

function normalizeAuthor(a: string): string {
  return a.trim().toLowerCase().replace(/\s+/g, " ");
}

// Goodreads wraps ISBNs as ="1234567890" (an Excel-formula escape to keep
// leading zeros); strip that down to the bare digits/X.
function cleanIsbn(raw: string): string | null {
  const stripped = raw.replace(/^="/, "").replace(/"$/, "").trim();
  return stripped.length > 0 ? stripped : null;
}

// Goodreads dates are "YYYY/MM/DD"; Postgres wants "YYYY-MM-DD".
function cleanDateRead(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function hasMoreData(a: Candidate, b: Candidate): boolean {
  const score = (c: Candidate) => (c.isbn ? 1 : 0) + (c.dateFinished ? 1 : 0);
  return score(a) >= score(b);
}

async function main() {
  // Read as UTF-8 text ourselves and hand SheetJS a string -- letting it
  // read the file directly triggers its own codepage auto-detection, which
  // mis-decodes accented characters (e.g. "Pappé" becomes "PappÃ©").
  const csvText = readFileSync(CSV_PATH, "utf8");
  const workbook = XLSX.read(csvText, { type: "string" });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<GoodreadsRow>(workbook.Sheets[sheetName], {
    defval: "",
  });

  // Group Goodreads rows by normalized title -- titles can collide across
  // different books (see "War" above).
  const byTitle = new Map<string, Candidate[]>();
  for (const r of rows) {
    const key = normalizeTitle(String(r.Title));
    const candidate: Candidate = {
      author: String(r.Author),
      normAuthor: normalizeAuthor(String(r.Author)),
      isbn: cleanIsbn(String(r.ISBN13)) ?? cleanIsbn(String(r.ISBN)),
      dateFinished: cleanDateRead(String(r["Date Read"])),
    };
    const list = byTitle.get(key) ?? [];
    list.push(candidate);
    byTitle.set(key, list);
  }

  const { rows: books } = await pool.query<DbBook>(
    `select book_id, title, author, isbn, date_finished from books`
  );

  const isbnUpdates: { book_id: number; isbn: string }[] = [];
  const dateUpdates: { book_id: number; date_finished: string }[] = [];
  const unmatchedTitles: string[] = [];
  const authorMismatches: { title: string; dbAuthor: string; csvAuthors: string[] }[] = [];
  const ambiguous: { title: string; chosenAuthor: string; otherAuthors: string[] }[] = [];

  for (const book of books) {
    const key = normalizeTitle(book.title);
    const candidates = byTitle.get(key);

    if (!candidates || candidates.length === 0) {
      unmatchedTitles.push(book.title);
      continue;
    }

    const dbNormAuthor = normalizeAuthor(book.author);
    const authorMatches = candidates.filter((c) => c.normAuthor === dbNormAuthor);

    let chosen: Candidate;
    if (authorMatches.length === 1) {
      chosen = authorMatches[0];
    } else if (authorMatches.length > 1) {
      chosen = authorMatches.reduce((best, c) => (hasMoreData(c, best) ? c : best));
      ambiguous.push({
        title: book.title,
        chosenAuthor: chosen.author,
        otherAuthors: authorMatches.filter((c) => c !== chosen).map((c) => c.author),
      });
    } else {
      authorMismatches.push({
        title: book.title,
        dbAuthor: book.author,
        csvAuthors: candidates.map((c) => c.author),
      });
      continue;
    }

    if (book.isbn === null && chosen.isbn) {
      isbnUpdates.push({ book_id: book.book_id, isbn: chosen.isbn });
    }
    if (book.date_finished === null && chosen.dateFinished) {
      dateUpdates.push({ book_id: book.book_id, date_finished: chosen.dateFinished });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (isbnUpdates.length > 0) {
      await client.query(
        `update books as b
         set isbn = coalesce(b.isbn, v.isbn)
         from unnest($1::int[], $2::text[]) as v(book_id, isbn)
         where b.book_id = v.book_id`,
        [isbnUpdates.map((u) => u.book_id), isbnUpdates.map((u) => u.isbn)]
      );
    }

    if (dateUpdates.length > 0) {
      await client.query(
        `update books as b
         set date_finished = coalesce(b.date_finished, v.date_finished)
         from unnest($1::int[], $2::date[]) as v(book_id, date_finished)
         where b.book_id = v.book_id`,
        [dateUpdates.map((u) => u.book_id), dateUpdates.map((u) => u.date_finished)]
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

  console.log(`Books in database: ${books.length}`);
  console.log(`Goodreads export rows: ${rows.length}`);
  console.log(`isbn backfilled: ${isbnUpdates.length}`);
  console.log(`date_finished backfilled: ${dateUpdates.length}`);
  console.log(
    `date_started: NOT backfilled -- the Goodreads export has no "Date Started" column, ` +
      `only "Date Read" (used above for date_finished).`
  );

  if (ambiguous.length > 0) {
    console.warn(
      `\n${ambiguous.length} title(s) matched multiple Goodreads rows by the same author; ` +
        `picked the one with more data:`
    );
    for (const a of ambiguous) {
      console.warn(`  - ${a.title} (${a.chosenAuthor}) -- also saw: ${a.otherAuthors.join(", ")}`);
    }
  }

  if (authorMismatches.length > 0) {
    console.warn(
      `\n${authorMismatches.length} title(s) matched in Goodreads but by a different author ` +
        `(left untouched -- check these manually):`
    );
    for (const m of authorMismatches) {
      console.warn(`  - "${m.title}" -- db: ${m.dbAuthor} / csv: ${m.csvAuthors.join(", ")}`);
    }
  }

  if (unmatchedTitles.length > 0) {
    console.warn(`\n${unmatchedTitles.length} book(s) had no matching title in the Goodreads export:`);
    for (const t of unmatchedTitles) console.warn(`  - ${t}`);
  } else {
    console.log("\nEvery book's title was found in the Goodreads export.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
