// Migrates rambler_reviews (an old per-category "Rambler" review system --
// 39 rows across 6 authors, each with one review split into category
// fragments: Characters, Plot, Prose, an overall summary, etc.) into a
// formatted plain-text books.legacy_notes column. Doesn't touch books.review.
//
// Mapping is hardcoded below (given by the user, not derived): each
// review_subject (an author) maps to exactly one book they wrote.
//
// Usage:
//   npm run migrate:rambler-reviews            -- dry run, prints the formatted text
//   npm run migrate:rambler-reviews -- --write  -- writes legacy_notes

import { config } from "dotenv";
import path from "node:path";
import { Pool } from "pg";

config({ path: path.join(process.cwd(), ".env.local") });

const WRITE = process.argv.includes("--write");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

// review_subject (exact string stored in rambler_reviews) -> book title
// (exact string stored in books.title). Both sides confirmed by direct query
// to match exactly one row each.
const MAPPING: { subject: string; title: string }[] = [
  { subject: "Travis Baldree", title: "Bookshops and Bonedust" },
  { subject: "Sarah J Maas", title: "Throne of Glass" },
  { subject: "Robin Hobb", title: "Assassin's Quest" },
  { subject: "John Steinbeck", title: "East of Eden" },
  { subject: "Mary Shelley", title: "Frankenstein" },
  { subject: "Henry David The", title: "Walden" }, // stored review_subject is truncated ("Henry David Thoreau" cut off)
];

type RamblerRow = {
  id: number;
  review_subject: string;
  category: string;
  score: number;
  commentary: string;
};

function formatNotes(rows: RamblerRow[]): string {
  return rows
    .map((r) => `${r.category} — ${r.score.toFixed(1)}/5\n${r.commentary}`)
    .join("\n\n");
}

async function main() {
  const { rows: ramblerRows } = await pool.query<RamblerRow>(
    `select id, review_subject, category, score::float8 as score, commentary
     from rambler_reviews
     order by review_subject, id`
  );

  const results: { book_id: number; title: string; author: string; text: string }[] = [];
  const problems: string[] = [];

  for (const { subject, title } of MAPPING) {
    const rowsForSubject = ramblerRows.filter((r) => r.review_subject === subject);
    if (rowsForSubject.length === 0) {
      problems.push(`No rambler_reviews rows found for review_subject "${subject}"`);
      continue;
    }

    const { rows: bookRows } = await pool.query<{ book_id: number; title: string; author: string; legacy_notes: string | null }>(
      `select book_id, title, author, legacy_notes from books where title = $1`,
      [title]
    );
    if (bookRows.length === 0) {
      problems.push(`No book found titled "${title}" (for ${subject})`);
      continue;
    }
    if (bookRows.length > 1) {
      problems.push(`Multiple books titled "${title}" (for ${subject}) -- can't safely pick one`);
      continue;
    }

    const book = bookRows[0];
    results.push({ book_id: book.book_id, title: book.title, author: book.author, text: formatNotes(rowsForSubject) });
  }

  console.log("=".repeat(70));
  console.log(WRITE ? "WRITE MODE -- applying changes" : "DRY RUN -- no changes will be made");
  console.log("=".repeat(70));

  for (const r of results) {
    console.log(`\n${"-".repeat(70)}`);
    console.log(`#${r.book_id} ${r.title} (${r.author})`);
    console.log("-".repeat(70));
    console.log(r.text);
  }

  if (problems.length > 0) {
    console.log(`\n${"!".repeat(70)}`);
    console.log(`Problems (${problems.length}):`);
    for (const p of problems) console.log(`  ${p}`);
    console.log("!".repeat(70));
  }

  console.log(`\n--- Summary ---`);
  console.log(`Mapped authors: ${MAPPING.length}`);
  console.log(`Ready to write: ${results.length}`);
  console.log(`Problems: ${problems.length}`);

  if (!WRITE) {
    console.log("\nDry run only -- re-run with --write to apply.");
    await pool.end();
    return;
  }

  if (problems.length > 0) {
    console.log("\nRefusing to write: problems found above.");
    await pool.end();
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of results) {
      await client.query(`update books set legacy_notes = $1 where book_id = $2`, [r.text, r.book_id]);
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
