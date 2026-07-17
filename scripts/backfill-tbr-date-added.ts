// Backfills tbr.created_at from Goodreads' "Date Added" column.
//
// tbr.created_at currently holds import-batch timestamps (when the row was
// bulk-inserted into this app), not when the book was actually added to the
// user's reading list -- of 813 rows, all but 2 share one of just two exact
// timestamps. Goodreads' own "Date Added" is the real signal, so this
// overwrites created_at with it wherever a row matches confidently.
//
// Matching mirrors scripts/goodreads-sync.ts's TBR job exactly (normalized
// title, series-suffix-stripped with a fallback to the unstripped title,
// cross-checked against a roughly-matching author) -- duplicated here rather
// than imported since goodreads-sync.ts doesn't export these as a module.
// Anything that doesn't resolve cleanly (no CSV match, multiple candidates
// disagreeing on author or date, or an author mismatch) is left untouched
// and reported for manual review, never guessed at.
//
// Usage:
//   npm run backfill:tbr-date-added            -- dry run, prints the report
//   npm run backfill:tbr-date-added -- --write  -- applies in one transaction

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

type GoodreadsRow = {
  Title: string;
  Author: string;
  "Date Added": string;
  "Exclusive Shelf": string;
};

type DbTbr = {
  id: number;
  title: string;
  author: string | null;
};

function cleanDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function normalizeAuthor(a: string): string {
  return a.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeAuthorLoose(a: string): string {
  return a
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function authorsRoughlyMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return true;
  const na = normalizeAuthor(a);
  const nb = normalizeAuthor(b);
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  return normalizeAuthorLoose(a) === normalizeAuthorLoose(b);
}

function stripGoodreadsSeriesSuffix(title: string): string {
  return title.replace(/\s*\([^()]*\)\s*$/, "");
}

function normalizeCsvTitle(title: string): string {
  return normalizeTitle(stripGoodreadsSeriesSuffix(title));
}

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
      // skip; \n below ends the row
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

async function main() {
  const csvText = readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(csvText) as unknown as GoodreadsRow[];

  const { rows: tbrRows } = await pool.query<DbTbr>(`select id, title, author from tbr`);

  const tbrCandidates = rows.filter(
    (r) => r["Exclusive Shelf"] === "to-read" || r["Exclusive Shelf"] === "will-purchase"
  );
  const candidatesByNorm = group(tbrCandidates, (r) => normalizeCsvTitle(r.Title));

  function candidatesFor(tbrTitle: string): GoodreadsRow[] {
    const primaryKey = normalizeCsvTitle(tbrTitle);
    const primary = candidatesByNorm.get(primaryKey) ?? [];
    const fallbackKey = normalizeTitle(tbrTitle);
    if (fallbackKey === primaryKey) return primary;
    const fallback = candidatesByNorm.get(fallbackKey) ?? [];
    if (fallback.length === 0) return primary;
    const merged = [...primary];
    for (const item of fallback) if (!merged.includes(item)) merged.push(item);
    return merged;
  }

  // Fallback tier: tbr often stores just the main title while Goodreads has
  // "Title: Subtitle" (or "Title - Subtitle"/"Title, Subtitle") -- a prefix
  // match at a natural title/subtitle boundary, confirmed by spot-checking
  // ("Guns, Germs, and Steel" -> "Guns, Germs, and Steel: The Fates of Human
  // Societies") to cover the large majority of otherwise-unmatched rows.
  function prefixCandidatesFor(tbrTitle: string): GoodreadsRow[] {
    const tNorm = normalizeCsvTitle(tbrTitle);
    return tbrCandidates.filter((r) => {
      const rNorm = normalizeCsvTitle(r.Title);
      return rNorm !== tNorm && (rNorm.startsWith(`${tNorm}:`) || rNorm.startsWith(`${tNorm} -`) || rNorm.startsWith(`${tNorm},`));
    });
  }

  const dateUpdates: { id: number; title: string; date_added: string; tier: "exact" | "subtitle" }[] = [];
  const noCsvMatch: { id: number; title: string }[] = [];
  const authorMismatches: { id: number; title: string; dbAuthor: string | null; csvAuthors: string[] }[] = [];
  const noDateAdded: { id: number; title: string }[] = [];
  const ambiguous: { id: number; title: string; dates: string[] }[] = [];

  for (const tbrRow of tbrRows) {
    let tier: "exact" | "subtitle" = "exact";
    let rawCandidates = candidatesFor(tbrRow.title);
    if (rawCandidates.length === 0) {
      rawCandidates = prefixCandidatesFor(tbrRow.title);
      tier = "subtitle";
    }
    const candidates = rawCandidates.filter((c) => authorsRoughlyMatch(tbrRow.author, c.Author));

    if (candidates.length === 0) {
      if (rawCandidates.length > 0) {
        authorMismatches.push({
          id: tbrRow.id,
          title: tbrRow.title,
          dbAuthor: tbrRow.author,
          csvAuthors: rawCandidates.map((c) => c.Author),
        });
      } else {
        noCsvMatch.push({ id: tbrRow.id, title: tbrRow.title });
      }
      continue;
    }

    const dates = new Set(candidates.map((c) => cleanDate(c["Date Added"])).filter((d): d is string => d !== null));

    if (dates.size === 0) {
      noDateAdded.push({ id: tbrRow.id, title: tbrRow.title });
      continue;
    }
    if (dates.size > 1) {
      ambiguous.push({ id: tbrRow.id, title: tbrRow.title, dates: [...dates] });
      continue;
    }

    dateUpdates.push({ id: tbrRow.id, title: tbrRow.title, date_added: [...dates][0], tier });
  }

  const exactCount = dateUpdates.filter((u) => u.tier === "exact").length;
  const subtitleCount = dateUpdates.filter((u) => u.tier === "subtitle").length;

  console.log("=".repeat(70));
  console.log(WRITE ? "WRITE MODE -- applying changes" : "DRY RUN -- no changes will be made");
  console.log("=".repeat(70));

  console.log(`\nExisting tbr rows: ${tbrRows.length}`);
  console.log(`Date added to backfill: ${dateUpdates.length} (${exactCount} exact title match, ${subtitleCount} subtitle-prefix match)`);
  console.log(`No CSV title match (left untouched): ${noCsvMatch.length}`);
  console.log(`Title matched but author mismatched (left untouched, review manually): ${authorMismatches.length}`);
  console.log(`Matched but CSV has no Date Added value (left untouched): ${noDateAdded.length}`);
  console.log(`Matched multiple candidates disagreeing on date (left untouched, review manually): ${ambiguous.length}`);

  if (authorMismatches.length > 0) {
    console.log(`\n--- Author mismatches ---`);
    for (const m of authorMismatches) {
      console.log(`  #${m.id} "${m.title}" -- tbr: ${m.dbAuthor ?? "(none)"} / csv: ${m.csvAuthors.join(", ")}`);
    }
  }
  if (ambiguous.length > 0) {
    console.log(`\n--- Ambiguous (multiple differing dates) ---`);
    for (const a of ambiguous) console.log(`  #${a.id} "${a.title}" -- dates seen: ${a.dates.join(", ")}`);
  }
  if (noCsvMatch.length > 0) {
    console.log(`\n--- No CSV match ---`);
    for (const n of noCsvMatch) console.log(`  #${n.id} "${n.title}"`);
  }
  if (noDateAdded.length > 0) {
    console.log(`\n--- Matched, no Date Added in CSV ---`);
    for (const n of noDateAdded) console.log(`  #${n.id} "${n.title}"`);
  }

  if (!WRITE) {
    console.log("\nDry run only -- re-run with --write to apply.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const u of dateUpdates) {
      await client.query(`update tbr set created_at = $1::date where id = $2`, [u.date_added, u.id]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  console.log(`\nApplied: ${dateUpdates.length} row(s) updated.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
