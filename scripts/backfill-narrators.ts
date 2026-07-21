// Builds the narrators table from books.narrator (comma-separated -- the
// only separator actually in use; confirmed no "&"/"and" in the live data),
// and links audiobooks to their narrator(s) via book_narrators. books
// with a full-cast credit ("Full Cast") are skipped entirely -- that's not
// a real person, so no narrator row is created for it and those books stay
// unlinked (their raw books.narrator text still displays as a fallback
// wherever narrator is shown). books.narrator (free text) is untouched.
//
// Usage:
//   npm run backfill:narrators            -- dry run, prints the report
//   npm run backfill:narrators -- --write -- applies in one transaction

import { config } from "dotenv";
import path from "node:path";
import { Pool } from "pg";

config({ path: path.join(process.cwd(), ".env.local") });

const WRITE = process.argv.includes("--write");
const SKIP_NAMES = new Set(["full cast"]);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

function normalizeNameKey(n: string): string {
  return n
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");
}

function splitNarrators(raw: string): string[] {
  return raw
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && !SKIP_NAMES.has(normalizeNameKey(n)));
}

async function main() {
  const { rows: bookRows } = await pool.query<{ book_id: number; narrator: string }>(
    `select book_id, narrator from books where narrator is not null and trim(narrator) != ''`
  );

  const perBook = bookRows.map((r) => ({ book_id: r.book_id, names: splitNarrators(r.narrator) }));
  const allNames = perBook.flatMap((b) => b.names);
  const distinctNames = Array.from(new Set(allNames)).sort();

  // ---------- Near-duplicate detection ----------
  const byNormalized = new Map<string, string[]>();
  for (const n of distinctNames) {
    const key = normalizeNameKey(n);
    if (!byNormalized.has(key)) byNormalized.set(key, []);
    byNormalized.get(key)!.push(n);
  }
  const exactDupes = Array.from(byNormalized.values()).filter((v) => v.length > 1);

  // ---------- Existing narrators / links needed ----------
  const { rows: existingNarrators } = await pool.query<{ id: number; name: string }>(`select id, name from narrators`);
  const existingByName = new Map(existingNarrators.map((n) => [n.name, n.id]));
  const toInsert = distinctNames.filter((n) => !existingByName.has(n));

  const { rows: existingLinks } = await pool.query<{ book_id: number; narrator_id: number }>(
    `select book_id, narrator_id from book_narrators`
  );
  const linkedSet = new Set(existingLinks.map((l) => `${l.book_id}:${l.narrator_id}`));

  const skippedBooks = bookRows.filter((r) => {
    const names = splitNarrators(r.narrator);
    return names.length === 0;
  });

  const multiNarratorBooks = perBook.filter((b) => b.names.length > 1);

  // ---------- Report ----------
  console.log("=".repeat(70));
  console.log(WRITE ? "WRITE MODE -- applying changes" : "DRY RUN -- no changes will be made");
  console.log("=".repeat(70));

  console.log(`\n--- Distinct narrator names (${distinctNames.length}) ---`);
  for (const n of distinctNames) console.log(`  ${n}`);

  console.log(`\n--- Exact-normalized duplicates (${exactDupes.length}) ---`);
  for (const group of exactDupes) console.log(`  ${group.join(" == ")}`);

  console.log(`\n--- New narrator rows to insert (${toInsert.length} of ${distinctNames.length}) ---`);
  for (const n of toInsert) console.log(`  ${n}`);

  console.log(`\n--- Books skipped entirely (no real narrator credited, e.g. "Full Cast") (${skippedBooks.length}) ---`);
  for (const b of skippedBooks) console.log(`  #${b.book_id} "${b.narrator}"`);

  console.log(`\n--- Multi-narrator books (duets/casts) (${multiNarratorBooks.length}) ---`);
  for (const b of multiNarratorBooks) console.log(`  #${b.book_id}: ${b.names.join(", ")}`);

  const linksToCreate = perBook.flatMap((b) =>
    b.names
      .map((name) => ({ book_id: b.book_id, name }))
      .filter(({ name }) => {
        const id = existingByName.get(name);
        return id == null || !linkedSet.has(`${b.book_id}:${id}`);
      })
  );

  console.log(`\n--- Summary ---`);
  console.log(`Audiobooks with a narrator credit: ${bookRows.length}`);
  console.log(`Distinct narrator names: ${distinctNames.length}`);
  console.log(`New narrator rows: ${toInsert.length}`);
  console.log(`Exact-normalized duplicate groups: ${exactDupes.length}`);
  console.log(`Books skipped (no real narrator): ${skippedBooks.length}`);
  console.log(`Multi-narrator books: ${multiNarratorBooks.length}`);
  console.log(`book_narrators links to create: ${linksToCreate.length}`);

  if (exactDupes.length > 0) {
    console.log(`\n!! Exact-normalized duplicates found -- resolve these before writing. !!`);
  }

  if (!WRITE) {
    console.log("\nDry run only -- re-run with --write to apply.");
    await pool.end();
    return;
  }

  if (exactDupes.length > 0) {
    console.log("\nRefusing to write: exact-normalized duplicates must be resolved first.");
    await pool.end();
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const name of toInsert) {
      await client.query(`insert into narrators (name) values ($1) on conflict (name) do nothing`, [name]);
    }

    const { rows: narratorIdRows } = await client.query<{ id: number; name: string }>(`select id, name from narrators`);
    const narratorIdByName = new Map(narratorIdRows.map((n) => [n.name, n.id]));

    for (const b of perBook) {
      for (const name of b.names) {
        const narratorId = narratorIdByName.get(name);
        if (narratorId == null) continue;
        await client.query(
          `insert into book_narrators (book_id, narrator_id) values ($1, $2) on conflict do nothing`,
          [b.book_id, narratorId]
        );
      }
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
