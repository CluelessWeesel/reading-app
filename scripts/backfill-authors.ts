// Builds the authors table from the distinct author strings on books, links
// books.author_id accordingly, and lazily links/backfills tbr's author
// fields. books.author (free text) is untouched -- author_id is additive.
//
// Steps:
//   1. authors: one row per distinct books.author, skipping ones that
//      already exist (safe to re-run).
//   2. books.author_id: set via exact name match (always 100%, since
//      authors is built FROM these same strings).
//   3. tbr.author_id: for tbr rows with an author already filled in, link
//      to an existing author row if the name matches one you've actually
//      read. Most won't match -- that's expected, not an error.
//   4. tbr.author backfill: for tbr rows with NO author at all, infer one
//      from data/goodreads_library_export.csv by exact normalized title
//      match, only when the CSV has exactly one distinct author for that
//      title (never guessed at when ambiguous). Also links author_id where
//      the inferred name matches an existing author.
//
// Near-duplicate names (case/punctuation/initials variants) are flagged in
// the dry-run report for manual review -- never merged automatically.
//
// Usage:
//   npm run backfill:authors            -- dry run, prints the report
//   npm run backfill:authors -- --write -- applies in one transaction

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { normalizeTitle } from "./lib/normalizeTitle";

config({ path: path.join(process.cwd(), ".env.local") });

const CSV_PATH = path.join(process.cwd(), "data", "goodreads_library_export.csv");
const WRITE = process.argv.includes("--write");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

// Same hand-rolled parser as scripts/goodreads-sync.ts (kept local -- this
// is a one-off migration script, not a shared library).
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // skip; \n ends the row
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const header = rows[0];
  return rows
    .slice(1)
    .filter((r) => r.length > 1 || r[0] !== "")
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, idx) => {
        obj[h] = r[idx] ?? "";
      });
      return obj;
    });
}

function normalizeAuthorKey(a: string): string {
  return a
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");
}

function lastNameOf(a: string): string {
  const parts = a.trim().split(/\s+/);
  return parts[parts.length - 1].replace(/[.,]/g, "").toLowerCase();
}

async function main() {
  const { rows: authorRows } = await pool.query<{ author: string }>(
    `select distinct author from books order by author`
  );
  const bookAuthors = authorRows.map((r) => r.author);

  // ---------- Near-duplicate detection ----------
  const byNormalized = new Map<string, string[]>();
  for (const a of bookAuthors) {
    const key = normalizeAuthorKey(a);
    if (!byNormalized.has(key)) byNormalized.set(key, []);
    byNormalized.get(key)!.push(a);
  }
  const exactDupes = Array.from(byNormalized.values()).filter((v) => v.length > 1);

  const byLastName = new Map<string, string[]>();
  for (const a of bookAuthors) {
    const key = lastNameOf(a);
    if (!byLastName.has(key)) byLastName.set(key, []);
    byLastName.get(key)!.push(a);
  }
  const sharedLastName = Array.from(byLastName.values()).filter((v) => v.length > 1);

  // ---------- Existing authors / books.author_id ----------
  const { rows: existingAuthors } = await pool.query<{ id: number; name: string }>(`select id, name from authors`);
  const existingByName = new Map(existingAuthors.map((a) => [a.name, a.id]));
  const toInsert = bookAuthors.filter((a) => !existingByName.has(a));

  const { rows: booksNeedingLink } = await pool.query<{ book_id: number; author: string }>(
    `select book_id, author from books where author_id is null`
  );

  // ---------- tbr.author_id for already-filled authors ----------
  const { rows: tbrWithAuthor } = await pool.query<{ id: number; author: string }>(
    `select id, author from tbr where author is not null and author_id is null`
  );
  const tbrLinkable = tbrWithAuthor.filter((t) => existingByName.has(t.author) || bookAuthors.includes(t.author));

  // ---------- tbr author inference from Goodreads CSV ----------
  const csvText = readFileSync(CSV_PATH, "utf8");
  const csvRows = parseCsv(csvText);
  const csvByTitle = new Map<string, Set<string>>();
  for (const r of csvRows) {
    const author = (r.Author ?? "").trim().replace(/\s+/g, " ");
    if (!author) continue;
    const key = normalizeTitle(r.Title ?? "");
    if (!csvByTitle.has(key)) csvByTitle.set(key, new Set());
    csvByTitle.get(key)!.add(author);
  }

  const { rows: tbrNoAuthor } = await pool.query<{ id: number; title: string }>(
    `select id, title from tbr where author is null`
  );
  const inferred: { id: number; title: string; author: string }[] = [];
  const noMatch: { id: number; title: string }[] = [];
  for (const t of tbrNoAuthor) {
    const candidates = csvByTitle.get(normalizeTitle(t.title));
    if (candidates && candidates.size === 1) {
      inferred.push({ id: t.id, title: t.title, author: [...candidates][0] });
    } else {
      noMatch.push({ id: t.id, title: t.title });
    }
  }
  const inferredLinkable = inferred.filter((i) => existingByName.has(i.author) || bookAuthors.includes(i.author));

  // ---------- Report ----------
  console.log("=".repeat(70));
  console.log(WRITE ? "WRITE MODE -- applying changes" : "DRY RUN -- no changes will be made");
  console.log("=".repeat(70));

  console.log(`\n--- Authors from books (${bookAuthors.length}) ---`);
  for (const a of bookAuthors) console.log(`  ${a}`);

  console.log(`\n--- Exact-normalized duplicates (${exactDupes.length}) ---`);
  for (const group of exactDupes) console.log(`  ${group.join(" == ")}`);

  console.log(`\n--- Shared last name, worth a human glance (${sharedLastName.length}) ---`);
  for (const group of sharedLastName) console.log(`  ${group.join(" / ")}`);

  console.log(`\n--- New author rows to insert (${toInsert.length} of ${bookAuthors.length}) ---`);
  for (const a of toInsert) console.log(`  ${a}`);

  console.log(`\n--- books.author_id to set (${booksNeedingLink.length}) ---`);
  console.log(`  (one per remaining unlinked book, matched by exact author name)`);

  console.log(`\n--- tbr.author_id to link from existing author text (${tbrLinkable.length} of ${tbrWithAuthor.length}) ---`);
  for (const t of tbrLinkable.slice(0, 15)) console.log(`  #${t.id} ${t.author}`);
  if (tbrLinkable.length > 15) console.log(`  ...and ${tbrLinkable.length - 15} more`);

  console.log(`\n--- tbr author inferred from Goodreads CSV (${inferred.length} of ${tbrNoAuthor.length} with no author) ---`);
  for (const i of inferred.slice(0, 20)) console.log(`  #${i.id} "${i.title}" -> ${i.author}`);
  if (inferred.length > 20) console.log(`  ...and ${inferred.length - 20} more`);
  console.log(`  ...of which ${inferredLinkable.length} also link to an existing author you've read`);

  console.log(`\n--- No match in Goodreads CSV, left as-is (${noMatch.length}) ---`);
  for (const n of noMatch.slice(0, 10)) console.log(`  #${n.id} ${n.title}`);
  if (noMatch.length > 10) console.log(`  ...and ${noMatch.length - 10} more`);

  console.log(`\n--- Summary ---`);
  console.log(`Distinct authors (books): ${bookAuthors.length}`);
  console.log(`New author rows: ${toInsert.length}`);
  console.log(`Exact-normalized duplicate groups: ${exactDupes.length}`);
  console.log(`Shared-last-name groups (informational): ${sharedLastName.length}`);
  console.log(`books.author_id to set: ${booksNeedingLink.length}`);
  console.log(`tbr.author_id linked from existing text: ${tbrLinkable.length}`);
  console.log(`tbr rows getting an inferred author: ${inferred.length}`);
  console.log(`  ...of which also linked to an existing author: ${inferredLinkable.length}`);
  console.log(`tbr rows with no inferable author: ${noMatch.length}`);

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
      await client.query(`insert into authors (name) values ($1) on conflict (name) do nothing`, [name]);
    }

    await client.query(
      `update books set author_id = a.id from authors a where books.author = a.name and books.author_id is null`
    );

    await client.query(
      `update tbr set author_id = a.id from authors a where tbr.author = a.name and tbr.author_id is null`
    );

    for (const i of inferred) {
      await client.query(`update tbr set author = $1 where id = $2`, [i.author, i.id]);
    }
    await client.query(
      `update tbr set author_id = a.id from authors a where tbr.author = a.name and tbr.author_id is null`
    );

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
