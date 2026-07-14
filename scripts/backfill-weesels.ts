// Links the existing free-text weesels rows (2023-2025) to the new
// weesel_categories table and, where a nominee is actually a book, to
// books.book_id. Also deletes 15 non-nomination rows that turn out to be a
// mis-imported spreadsheet legend, and backfills books.indie from Best
// Indie nominees.
//
// Background: 2025's weesels rows include categories '1st'..'11th' and
// 'Ranking Order for' -- these aren't nominations, they're literally the
// prestige-order legend table from the source spreadsheet (nominee values
// are category names like "Author of the Year", "Winners"/"Wins"/"Win
// Rate", etc.), imported as if they were real rows. They're deleted here,
// not remapped.
//
// Category aliasing: the DB's legacy category text doesn't always match
// weesel_categories.name exactly (e.g. "Best Series Finished" vs "Best
// Series") -- CATEGORY_ALIASES below is the full mapping, confirmed against
// live data before writing this script.
//
// book_id matching only applies to categories where the nominee is actually
// a book title (confirmed per-category from real rows): Novel of the Year,
// Non-Fiction of the Year, Best Indie, Most Thought-Provoking, Best to
// Recommend, Best Narration, Best Reread. For the rest (Author of the Year,
// Best New Author, Most Anticipated Author, Best Series) the nominee is an
// author or series name, not a book -- book_id is intentionally left null.
//
// Usage:
//   npm run backfill:weesels            -- dry run, prints the report
//   npm run backfill:weesels -- --write -- applies in one transaction

import { config } from "dotenv";
import path from "node:path";
import { Pool } from "pg";
import { normalizeTitle } from "./lib/normalizeTitle";

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

const JUNK_CATEGORIES = new Set([
  "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th",
  "Ranking Order for",
]);

// legacy weesels.category text -> canonical weesel_categories.name
const CATEGORY_ALIASES: Record<string, string> = {
  "Author of the Year": "Author of the Year",
  "Novel of the Year": "Novel of the Year",
  "Non-Fiction of the Year": "Non-Fiction of the Year",
  "Best New Author": "Best New Author",
  "Best Indie": "Best Indie",
  "Most Thought Provoking": "Most Thought-Provoking",
  "Best Series Finished": "Best Series",
  "Best Reread": "Best Reread",
  "Recomendation": "Best to Recommend",
  "Most Anticipated Author": "Most Anticipated Author",
  "Best Audio Narration": "Best Narration",
};

const BOOK_MATCHABLE_CATEGORIES = new Set([
  "Novel of the Year",
  "Non-Fiction of the Year",
  "Best Indie",
  "Most Thought-Provoking",
  "Best to Recommend",
  "Best Narration",
  "Best Reread",
]);

// Known nominee-title typos, confirmed against the books table earlier this
// session (e.g. while building the home page's honours widget) -- fixed
// here rather than left unmatched, since the correct book is already known
// with certainty, not guessed at.
const NOMINEE_TITLE_FIXES: Record<string, string> = {
  "The Paper Meangerie": "The Paper Menagerie",
};

type WeeselRow = {
  id: number;
  year: number;
  category: string;
  nominee: string;
  author_or_narrator: string | null;
  result: string;
};

async function main() {
  const { rows: weesels } = await pool.query<WeeselRow>(
    `select id, year, category, nominee, author_or_narrator, result from weesels order by year, category`
  );
  const { rows: categories } = await pool.query<{ id: number; name: string }>(
    `select id, name from weesel_categories`
  );
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

  const { rows: books } = await pool.query<{ book_id: number; title: string; author: string | null }>(
    `select book_id, title, author from books`
  );
  const booksByNormTitle = new Map<string, { book_id: number; title: string; author: string | null }[]>();
  for (const b of books) {
    const key = normalizeTitle(b.title);
    if (!booksByNormTitle.has(key)) booksByNormTitle.set(key, []);
    booksByNormTitle.get(key)!.push(b);
  }

  const junkRows = weesels.filter((w) => JUNK_CATEGORIES.has(w.category));
  const realRows = weesels.filter((w) => !JUNK_CATEGORIES.has(w.category));

  const unmappedCategories = realRows.filter((w) => !(w.category in CATEGORY_ALIASES));

  const categoryUpdates: { id: number; category_id: number }[] = [];
  for (const w of realRows) {
    const canonical = CATEGORY_ALIASES[w.category];
    if (!canonical) continue;
    const categoryId = categoryIdByName.get(canonical);
    if (categoryId == null) continue;
    categoryUpdates.push({ id: w.id, category_id: categoryId });
  }

  const bookMatched: { id: number; book_id: number; nominee: string }[] = [];
  const bookUnmatched: { id: number; year: number; category: string; nominee: string }[] = [];
  const bookAmbiguous: { id: number; year: number; category: string; nominee: string; candidates: number }[] = [];
  const bookSkippedByDesign: WeeselRow[] = [];

  for (const w of realRows) {
    const canonical = CATEGORY_ALIASES[w.category];
    if (!canonical || !BOOK_MATCHABLE_CATEGORIES.has(canonical)) {
      if (canonical) bookSkippedByDesign.push(w);
      continue;
    }
    const nomineeTitle = NOMINEE_TITLE_FIXES[w.nominee] ?? w.nominee;
    const candidates = booksByNormTitle.get(normalizeTitle(nomineeTitle)) ?? [];
    if (candidates.length === 1) {
      bookMatched.push({ id: w.id, book_id: candidates[0].book_id, nominee: w.nominee });
    } else if (candidates.length === 0) {
      bookUnmatched.push({ id: w.id, year: w.year, category: canonical, nominee: w.nominee });
    } else {
      // Try to break the tie using the author field.
      const byAuthor = w.author_or_narrator
        ? candidates.filter((c) => c.author?.toLowerCase() === w.author_or_narrator?.toLowerCase())
        : [];
      if (byAuthor.length === 1) {
        bookMatched.push({ id: w.id, book_id: byAuthor[0].book_id, nominee: w.nominee });
      } else {
        bookAmbiguous.push({ id: w.id, year: w.year, category: canonical, nominee: w.nominee, candidates: candidates.length });
      }
    }
  }

  const indieBookIds = Array.from(
    new Set(
      bookMatched
        .filter((m) => realRows.find((w) => w.id === m.id && CATEGORY_ALIASES[w.category] === "Best Indie"))
        .map((m) => m.book_id)
    )
  );

  // ---------- Report ----------
  console.log("=".repeat(70));
  console.log(WRITE ? "WRITE MODE -- applying changes" : "DRY RUN -- no changes will be made");
  console.log("=".repeat(70));

  console.log(`\n--- Junk legend rows to delete (${junkRows.length}) ---`);
  for (const j of junkRows) {
    console.log(`  #${j.id} [${j.category}] nominee="${j.nominee}" author_or_narrator="${j.author_or_narrator ?? ""}"`);
  }

  console.log(`\n--- Category text with no alias mapping (${unmappedCategories.length}) ---`);
  for (const u of unmappedCategories) console.log(`  #${u.id} [${u.category}] year=${u.year}`);

  console.log(`\n--- category_id updates (${categoryUpdates.length} of ${realRows.length} real rows) ---`);
  const byCanonical = new Map<string, number>();
  for (const w of realRows) {
    const canonical = CATEGORY_ALIASES[w.category];
    if (!canonical) continue;
    byCanonical.set(canonical, (byCanonical.get(canonical) ?? 0) + 1);
  }
  for (const [name, count] of byCanonical) console.log(`  ${name}: ${count} rows`);

  console.log(`\n--- book_id skipped by design (author/series categories, ${bookSkippedByDesign.length}) ---`);
  const skippedByCat = new Map<string, number>();
  for (const w of bookSkippedByDesign) {
    const c = CATEGORY_ALIASES[w.category];
    skippedByCat.set(c, (skippedByCat.get(c) ?? 0) + 1);
  }
  for (const [name, count] of skippedByCat) console.log(`  ${name}: ${count} rows (nominee is an author/series name)`);

  console.log(`\n--- book_id matched (${bookMatched.length}) ---`);
  console.log(`  (${indieBookIds.length} distinct books matched under Best Indie -> books.indie = true)`);

  console.log(`\n--- book_id unmatched, left null (${bookUnmatched.length}) ---`);
  for (const u of bookUnmatched) console.log(`  #${u.id} [${u.category}] ${u.year}: "${u.nominee}"`);

  console.log(`\n--- book_id ambiguous, left null for manual review (${bookAmbiguous.length}) ---`);
  for (const a of bookAmbiguous) console.log(`  #${a.id} [${a.category}] ${a.year}: "${a.nominee}" (${a.candidates} book matches)`);

  console.log(`\n--- Summary ---`);
  console.log(`Total weesels rows: ${weesels.length}`);
  console.log(`Junk legend rows to delete: ${junkRows.length}`);
  console.log(`Real rows: ${realRows.length}`);
  console.log(`category_id to set: ${categoryUpdates.length}`);
  console.log(`book_id matched: ${bookMatched.length}`);
  console.log(`book_id unmatched: ${bookUnmatched.length}`);
  console.log(`book_id ambiguous: ${bookAmbiguous.length}`);
  console.log(`book_id skipped by design: ${bookSkippedByDesign.length}`);
  console.log(`books.indie to set true: ${indieBookIds.length}`);

  if (unmappedCategories.length > 0) {
    console.log(`\n!! Unmapped category text found (outside expected junk rows) -- resolve before writing. !!`);
  }

  if (!WRITE) {
    console.log("\nDry run only -- re-run with --write to apply.");
    await pool.end();
    return;
  }

  if (unmappedCategories.length > 0) {
    console.log("\nRefusing to write: unmapped category text must be resolved first.");
    await pool.end();
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (junkRows.length > 0) {
      await client.query(`delete from weesels where id = any($1)`, [junkRows.map((j) => j.id)]);
    }

    for (const [oldText, canonical] of Object.entries(CATEGORY_ALIASES)) {
      const categoryId = categoryIdByName.get(canonical);
      if (categoryId == null) continue;
      await client.query(`update weesels set category_id = $1 where category = $2`, [categoryId, oldText]);
    }

    for (const m of bookMatched) {
      await client.query(`update weesels set book_id = $1 where id = $2`, [m.book_id, m.id]);
    }

    if (indieBookIds.length > 0) {
      await client.query(`update books set indie = true where book_id = any($1)`, [indieBookIds]);
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
