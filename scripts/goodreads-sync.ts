// Syncs data/goodreads_library_export.csv into the app beyond what
// backfill-goodreads.ts already does:
//   1. date_finished for "read" books, where currently null (no overwrites)
//   2. review text for "read" books, where currently null (no overwrites)
//   3. TBR rebuild: to-read/will-purchase rows become new tbr entries or
//      update owned on an existing matching entry
//
// Matching throughout: normalized titles (trim, case-insensitive, strip a
// trailing period, collapse whitespace, leading "the" optional) -- see
// scripts/lib/normalizeTitle.ts. Ambiguous matches (a normalized title
// shared by two different books/authors, or matching more than one existing
// row) are reported, never guessed at.
//
// currently-reading books are excluded from date/review matching -- a book
// mid-reread shares its title with its own completed prior read, and a CSV
// row's Date Read/review belongs to the FINISHED read, not the one in
// progress. (Confirmed cases: "The Book Thief" book_id 224 vs 227, "Feet of
// Clay" book_id 109 vs 228.)
//
// Usage:
//   npm run goodreads:sync            -- dry run, prints the report, no writes
//   npm run goodreads:sync -- --write  -- applies everything in one transaction
//
// Re-running after --write is safe: matched books/tbr rows that are already
// filled in no longer show up as candidates.

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
  "Number of Pages": string;
  "Date Read": string;
  "Exclusive Shelf": string;
  "My Review": string;
  "Year Published": string;
  "Original Publication Year": string;
};

type DbBook = {
  book_id: number;
  title: string;
  author: string | null;
  date_finished: string | null;
  review: string | null;
};

type DbTbr = {
  id: number;
  title: string;
  author: string | null;
  owned: boolean | null;
};

// Matches confirmed by hand for books/titles automatic matching (even the
// loose tier-2 pass) couldn't safely resolve on its own: stored-title typos
// ("The Heros" -> "The Heroes"), spelling/edition variants ("The Colour of
// Magic" -> "The Color of Magic", "The Stranger" -> "The Outsider"), an
// author stored in a different form (full name, or a co-author combined
// into one string), and one deliberate override of the author-mismatch
// safety net: "Heart of Darkness" by Adam Hochschild in the CSV is
// confirmed to actually be Joseph Conrad's book (a mislabeled author in the
// user's own Goodreads data), not a different book. Bypasses the normal
// matching pipeline entirely -- looked up by exact CSV title + author.
const CONFIRMED_MATCHES: { book_id: number; csvTitle: string; csvAuthor: string }[] = [
  { book_id: 13, csvTitle: "The Heroes", csvAuthor: "Joe Abercrombie" },
  { book_id: 67, csvTitle: "The Restaurant at the End of the Universe", csvAuthor: "Douglas Adams" },
  { book_id: 187, csvTitle: "Keep the Aspidistra Flying", csvAuthor: "George Orwell" },
  { book_id: 35, csvTitle: "The Color of Magic", csvAuthor: "Terry Pratchett" },
  { book_id: 186, csvTitle: "Frankenstein: The 1818 Text", csvAuthor: "Mary Wollstonecraft Shelley" },
  { book_id: 170, csvTitle: "Why Nations Fail: The Origins of Power, Prosperity, and Poverty", csvAuthor: "Daron Acemoğlu" },
  { book_id: 78, csvTitle: "The Fires of Vesuvius: Pompeii Lost and Found", csvAuthor: "Mary Beard" },
  { book_id: 136, csvTitle: "Around the World in Eighty Days", csvAuthor: "Jules Verne" },
  { book_id: 223, csvTitle: "The Outsider", csvAuthor: "Albert Camus" },
  { book_id: 197, csvTitle: "Heart of Darkness", csvAuthor: "Adam Hochschild" },
];

function cleanDateRead(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

// Goodreads renders line breaks in reviews as <br/> (checked: no other HTML
// tags appear in any review in this export).
function cleanReview(raw: string): string | null {
  const converted = raw.replace(/<br\s*\/?>/gi, "\n").trim();
  return converted.length > 0 ? converted : null;
}

function cleanPageCount(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

function normalizeAuthor(a: string): string {
  return a.trim().toLowerCase().replace(/\s+/g, " ");
}

// Punctuation/word-order-independent author comparison ("Cixin Liu" ==
// "Liu Cixin", "J.A.J Minton" == "J.A.J. Minton") -- used as a fallback by
// authorsRoughlyMatch below, and directly by the tier-2 title match.
function normalizeAuthorLoose(a: string): string {
  return a
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

// Matching is by title only (per spec), which is exactly how two unrelated
// books sharing a title would slip through silently -- confirmed real cases
// in this data: "The Fall" (Camus) vs "The Fall" (Ryan Cahill), "War"
// (Woodward) vs "War" (Junger), and "Heart of Darkness" (Conrad, in books)
// vs a CSV row titled the same by Adam Hochschild. A title match whose
// author clearly differs is excluded from application (not just noted) and
// reported for manual review instead. The loose fallback exists so genuinely
// the same author in a different word order/punctuation isn't excluded.
function authorsRoughlyMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return true; // nothing to compare against, don't flag
  const na = normalizeAuthor(a);
  const nb = normalizeAuthor(b);
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  return normalizeAuthorLoose(a) === normalizeAuthorLoose(b);
}

// Goodreads appends series info to the title itself, e.g.
// "Wyrd Sisters (Discworld, #6)" -- the app stores series separately (or,
// for tbr, doesn't track it structurally at all), so titles never carry
// this. Stripped only for MATCHING; the original title (suffix and all) is
// still what gets stored for new tbr rows, since tbr has nowhere else to
// keep that series/volume info.
function stripGoodreadsSeriesSuffix(title: string): string {
  return title.replace(/\s*\([^()]*\)\s*$/, "");
}

function normalizeCsvTitle(title: string): string {
  return normalizeTitle(stripGoodreadsSeriesSuffix(title));
}

// stripGoodreadsSeriesSuffix strips ANY trailing "(...)", which isn't always
// a Goodreads series marker -- a real case in this data: an existing tbr
// title ends in "(CPS)", an abbreviation the user added, not a series tag.
// Stripping it for matching would miss that it's already in tbr and try to
// insert a duplicate (a real unique-constraint failure this caught). So
// existing-row lookups check BOTH the series-stripped key and the plain
// (unstripped) one, and merge whatever either finds.
function lookupWithFallback<T>(map: Map<string, T[]>, csvTitle: string, primaryKey: string): T[] {
  const primary = map.get(primaryKey) ?? [];
  const fallbackKey = normalizeTitle(csvTitle);
  if (fallbackKey === primaryKey) return primary;
  const fallback = map.get(fallbackKey) ?? [];
  if (fallback.length === 0) return primary;
  const merged = [...primary];
  for (const item of fallback) {
    if (!merged.includes(item)) merged.push(item);
  }
  return merged;
}

function normalizeTitleLoose(title: string): string {
  return title
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&/g, " and ")
    .replace(/[-–—:]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(the|an?)\s+/, "");
}

// A hand-rolled RFC4180-ish parser, used deliberately instead of a
// spreadsheet library: SheetJS infers cell types from content, which
// silently turned "1984" (the title) into the number 1984 and "2026/07/06"
// (a Date Read) into an Excel date serial number (46209) -- both losslessly
// avoided by never letting anything but plain strings exist in the first
// place. Handles quoted fields with embedded commas/newlines and the
// doubled-quote escape ("" -> "), which covers this export (e.g. ISBNs are
// wrapped as "=""1234567890""").
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
      // skip; \n (below) ends the row
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

  const { rows: books } = await pool.query<DbBook>(
    `select book_id, title, author,
            to_char(date_finished, 'YYYY-MM-DD') as date_finished, review
     from books
     where status is distinct from 'reading'`
  );
  const { rows: tbrRows } = await pool.query<DbTbr>(`select id, title, author, owned from tbr`);

  const booksByNorm = group(books, (b) => normalizeTitle(b.title));
  const tbrByNorm = group(tbrRows, (t) => normalizeTitle(t.title));

  // ---------- Jobs 1 & 2: dates + reviews for "read" books ----------
  const readRows = rows.filter((r) => r["Exclusive Shelf"] === "read");
  const readByNorm = group(readRows, (r) => normalizeCsvTitle(r.Title));

  const dateUpdates: { book_id: number; title: string; date_finished: string }[] = [];
  const reviewUpdates: { book_id: number; title: string; review: string }[] = [];
  const alreadyHadReview: { book_id: number; title: string }[] = [];
  const ambiguousBookMatches: { normTitle: string; books: string[]; csvRows: string[] }[] = [];
  const unmatchedReadTitles: { title: string; author: string; hasDate: boolean; hasReview: boolean }[] = [];
  const authorMismatches: { context: string; title: string; dbAuthor: string | null; csvAuthor: string }[] = [];
  const looseMatches: { book_id: number; title: string; csvTitle: string }[] = [];
  const handledBookIds = new Set<number>();
  const consumedCsvRows = new Set<GoodreadsRow>();

  for (const [normTitle, matchedBooks] of booksByNorm) {
    const csvMatches = readByNorm.get(normTitle) ?? [];
    if (csvMatches.length === 0) continue;

    if (matchedBooks.length > 1 || csvMatches.length > 1) {
      ambiguousBookMatches.push({
        normTitle,
        books: matchedBooks.map((b) => `${b.title} (${b.author}) #${b.book_id}`),
        csvRows: csvMatches.map((c) => `${c.Title} (${c.Author})`),
      });
      for (const b of matchedBooks) handledBookIds.add(b.book_id);
      for (const c of csvMatches) consumedCsvRows.add(c);
      continue;
    }

    const book = matchedBooks[0];
    const csvRow = csvMatches[0];
    handledBookIds.add(book.book_id);
    consumedCsvRows.add(csvRow);
    const dateFinished = cleanDateRead(csvRow["Date Read"]);
    const review = cleanReview(csvRow["My Review"]);

    if (!authorsRoughlyMatch(book.author, csvRow.Author) && !CONFIRMED_MATCHES.some((m) => m.book_id === book.book_id)) {
      // Confirmed real cases of this: a CSV "Heart of Darkness" by Adam
      // Hochschild would otherwise silently overwrite Joseph Conrad's actual
      // "Heart of Darkness" -- title-only matching with a clearly different
      // author is excluded from application, not just noted (unless it's in
      // CONFIRMED_MATCHES above, which handles that one specific override).
      authorMismatches.push({
        context: "dates/reviews",
        title: book.title,
        dbAuthor: book.author,
        csvAuthor: csvRow.Author,
      });
      continue;
    }

    if (dateFinished && book.date_finished === null) {
      dateUpdates.push({ book_id: book.book_id, title: book.title, date_finished: dateFinished });
    }
    if (review) {
      if (book.review === null) {
        reviewUpdates.push({ book_id: book.book_id, title: book.title, review });
      } else {
        alreadyHadReview.push({ book_id: book.book_id, title: book.title });
      }
    }
  }

  for (const m of CONFIRMED_MATCHES) handledBookIds.add(m.book_id);

  // Tier-2: books tier-1's strict match found zero candidates for at all.
  // Loose title/author matching (see normalizeTitleLoose/normalizeAuthorLoose
  // above) -- only applied when it resolves to EXACTLY one candidate, same
  // safety principle as tier-1.
  for (const book of books) {
    if (handledBookIds.has(book.book_id)) continue;
    const bookAuthorLoose = normalizeAuthorLoose(book.author ?? "");
    const bookTitleLoose = normalizeTitleLoose(book.title);
    const candidates = readRows.filter((r) => {
      if (normalizeAuthorLoose(r.Author) !== bookAuthorLoose) return false;
      const csvLoose = normalizeTitleLoose(stripGoodreadsSeriesSuffix(r.Title));
      return csvLoose === bookTitleLoose || csvLoose.startsWith(`${bookTitleLoose} `);
    });
    if (candidates.length !== 1) continue;

    const csvRow = candidates[0];
    looseMatches.push({ book_id: book.book_id, title: book.title, csvTitle: csvRow.Title });
    consumedCsvRows.add(csvRow);

    const dateFinished = cleanDateRead(csvRow["Date Read"]);
    if (dateFinished && book.date_finished === null) {
      dateUpdates.push({ book_id: book.book_id, title: book.title, date_finished: dateFinished });
    }
    const review = cleanReview(csvRow["My Review"]);
    if (review) {
      if (book.review === null) {
        reviewUpdates.push({ book_id: book.book_id, title: book.title, review });
      } else {
        alreadyHadReview.push({ book_id: book.book_id, title: book.title });
      }
    }
  }

  // Confirmed matches the automatic pass found zero candidates for at all
  // (typos, edition/translation titles, author stored in a different form)
  // -- looked up directly by exact CSV title + author, bypassing normalized
  // matching entirely. (Heart of Darkness isn't here: it WAS found by the
  // normal pass above and just needed its author-mismatch exclusion waived,
  // handled inline there.)
  const confirmedApplied: { book_id: number; title: string }[] = [];
  for (const override of CONFIRMED_MATCHES) {
    if (override.book_id === 197) continue; // handled inline above
    const csvRow = rows.find(
      (r) => stripGoodreadsSeriesSuffix(r.Title.trim()) === override.csvTitle && r.Author.trim() === override.csvAuthor
    );
    const book = books.find((b) => b.book_id === override.book_id);
    if (!csvRow || !book) {
      console.warn(`CONFIRMED_MATCHES: couldn't find CSV row or book for book_id ${override.book_id}`);
      continue;
    }
    confirmedApplied.push({ book_id: book.book_id, title: book.title });
    consumedCsvRows.add(csvRow);

    const dateFinished = cleanDateRead(csvRow["Date Read"]);
    if (dateFinished && book.date_finished === null) {
      dateUpdates.push({ book_id: book.book_id, title: book.title, date_finished: dateFinished });
    }
    const review = cleanReview(csvRow["My Review"]);
    if (review) {
      if (book.review === null) {
        reviewUpdates.push({ book_id: book.book_id, title: book.title, review });
      } else {
        alreadyHadReview.push({ book_id: book.book_id, title: book.title });
      }
    }
  }

  for (const r of readRows) {
    if (consumedCsvRows.has(r)) continue;
    if (r["Date Read"].trim()) {
      unmatchedReadTitles.push({
        title: r.Title,
        author: r.Author,
        hasDate: Boolean(r["Date Read"].trim()),
        hasReview: Boolean(r["My Review"].trim()),
      });
    }
  }

  // ---------- Job 3: TBR rebuild ----------
  const tbrCandidates = rows.filter(
    (r) => r["Exclusive Shelf"] === "to-read" || r["Exclusive Shelf"] === "will-purchase"
  );
  const candidatesByNorm = group(tbrCandidates, (r) => normalizeCsvTitle(r.Title));

  type NewTbrRow = {
    title: string;
    author: string | null;
    owned: boolean;
    page_count: number | null;
  };
  const newRows: NewTbrRow[] = [];
  const ownedUpdates: { id: number; title: string; from: boolean | null; to: boolean }[] = [];
  const bookAnomalies: { title: string; author: string; matchedBook: string }[] = [];
  const internalCollisions: { normTitle: string; entries: string[] }[] = [];
  const tbrCollisions: { normTitle: string; csvTitle: string; tbrMatches: string[] }[] = [];

  for (const [normTitle, candidates] of candidatesByNorm) {
    if (candidates.length > 1) {
      const distinctAuthors = new Set(candidates.map((c) => normalizeAuthor(c.Author)));
      if (distinctAuthors.size > 1) {
        // Real collision: different books sharing a title (e.g. "War" by
        // Woodward vs. Junger). Disambiguate each with its publication year
        // and add both independently -- unless the shared title ALSO
        // collides with an existing books/tbr row, in which case there's
        // not enough to safely untangle that automatically.
        const clashesExisting =
          candidates.some((c) => lookupWithFallback(booksByNorm, c.Title, normTitle).length > 0) ||
          candidates.some((c) => lookupWithFallback(tbrByNorm, c.Title, normTitle).length > 0);
        if (clashesExisting) {
          internalCollisions.push({
            normTitle,
            entries: candidates.map((c) => `${c.Title} by ${c.Author} (${c["Exclusive Shelf"]})`),
          });
          continue;
        }
        for (const c of candidates) {
          const year = c["Original Publication Year"].trim() || c["Year Published"].trim() || null;
          newRows.push({
            title: year ? `${c.Title} (${year})` : c.Title,
            author: c.Author.trim() || null,
            owned: c["Exclusive Shelf"] === "to-read",
            page_count: cleanPageCount(c["Number of Pages"]),
          });
        }
        continue;
      }
      // Same title, same author, appears twice on the same shelf pair -- harmless, just dedupe.
    }
    const candidate = candidates[0];
    const owned = candidate["Exclusive Shelf"] === "to-read";

    const bookMatches = lookupWithFallback(booksByNorm, candidate.Title, normTitle).filter((b) =>
      authorsRoughlyMatch(b.author, candidate.Author)
    );
    if (bookMatches.length > 0) {
      bookAnomalies.push({
        title: candidate.Title,
        author: candidate.Author,
        matchedBook: bookMatches.map((b) => `${b.title} (${b.author}) #${b.book_id}`).join(", "),
      });
      continue;
    }

    const tbrMatches = lookupWithFallback(tbrByNorm, candidate.Title, normTitle);
    if (tbrMatches.length > 1) {
      tbrCollisions.push({
        normTitle,
        csvTitle: candidate.Title,
        tbrMatches: tbrMatches.map((t) => `${t.title} #${t.id}`),
      });
      continue;
    }
    if (tbrMatches.length === 1) {
      const existing = tbrMatches[0];
      if (!authorsRoughlyMatch(existing.author, candidate.Author)) {
        authorMismatches.push({
          context: "tbr dupe match",
          title: existing.title,
          dbAuthor: existing.author,
          csvAuthor: candidate.Author,
        });
        continue;
      }
      if (existing.owned !== owned) {
        ownedUpdates.push({ id: existing.id, title: existing.title, from: existing.owned, to: owned });
      }
      continue;
    }

    newRows.push({
      title: candidate.Title,
      author: candidate.Author.trim() || null,
      owned,
      page_count: cleanPageCount(candidate["Number of Pages"]),
    });
  }

  const matchedTbrIds = new Set(ownedUpdates.map((u) => u.id));
  const unsortedCount = tbrRows.filter((t) => !matchedTbrIds.has(t.id)).length;

  // ---------- Report ----------
  console.log("=".repeat(70));
  console.log(WRITE ? "WRITE MODE -- applying changes" : "DRY RUN -- no changes will be made");
  console.log("=".repeat(70));

  console.log(`\n--- Job 1: Dates (${dateUpdates.length} to fill) ---`);
  for (const u of dateUpdates) console.log(`  #${u.book_id} ${u.title} -> date_finished = ${u.date_finished}`);

  console.log(`\n--- Tier-2 loose matches (subtitle/punctuation differences, same author) (${looseMatches.length}) ---`);
  for (const l of looseMatches) console.log(`  #${l.book_id} "${l.title}" -> "${l.csvTitle}"`);

  console.log(`\n--- Confirmed-by-hand matches applied (${confirmedApplied.length}) ---`);
  for (const c of confirmedApplied) console.log(`  #${c.book_id} ${c.title}`);
  console.log(`  Left deliberately blank (no usable CSV date): #109 Feet of Clay, #224 The Book Thief`);

  console.log(`\n--- Unmatched read titles (${unmatchedReadTitles.length}) ---`);
  for (const u of unmatchedReadTitles) console.log(`  "${u.title}" by ${u.author}`);

  console.log(`\n--- Job 2: Reviews (${reviewUpdates.length} to fill) ---`);
  for (const u of reviewUpdates) console.log(`  #${u.book_id} ${u.title} (${u.review.length} chars)`);

  if (alreadyHadReview.length > 0) {
    console.log(`\n${"!".repeat(70)}`);
    console.log(`!! UNEXPECTED: ${alreadyHadReview.length} book(s) already had a review (expected 0) !!`);
    console.log("!".repeat(70));
    for (const a of alreadyHadReview) console.log(`  #${a.book_id} ${a.title}`);
  }

  if (authorMismatches.length > 0) {
    console.log(`\n--- Author mismatches on title-only matches (${authorMismatches.length}, excluded, please review) ---`);
    for (const m of authorMismatches) {
      console.log(`  [${m.context}] "${m.title}" -- db: ${m.dbAuthor ?? "(none)"} / csv: ${m.csvAuthor}`);
    }
  }

  if (ambiguousBookMatches.length > 0) {
    console.log(`\n--- Ambiguous book/CSV matches (${ambiguousBookMatches.length}, skipped) ---`);
    for (const a of ambiguousBookMatches) {
      console.log(`  "${a.normTitle}": books=[${a.books.join(" | ")}] csv=[${a.csvRows.join(" | ")}]`);
    }
  }

  console.log(`\n--- Job 3: TBR anomalies -- CSV to-read/will-purchase already in books (${bookAnomalies.length}) ---`);
  for (const a of bookAnomalies) console.log(`  "${a.title}" by ${a.author} -> matches ${a.matchedBook}`);

  if (internalCollisions.length > 0) {
    console.log(`\n--- TBR candidate collisions -- same title, different authors (${internalCollisions.length}, skipped) ---`);
    for (const c of internalCollisions) console.log(`  "${c.normTitle}": ${c.entries.join(" | ")}`);
  }

  if (tbrCollisions.length > 0) {
    console.log(`\n--- Existing tbr collisions (${tbrCollisions.length}, skipped) ---`);
    for (const c of tbrCollisions) console.log(`  "${c.csvTitle}" matches multiple tbr rows: ${c.tbrMatches.join(", ")}`);
  }

  console.log(`\n--- TBR dupes matched -- owned updated (${ownedUpdates.length}) ---`);
  for (const u of ownedUpdates) console.log(`  #${u.id} ${u.title}: owned ${u.from} -> ${u.to}`);

  console.log(`\n--- TBR new rows proposed (${newRows.length}) ---`);
  for (const r of newRows) {
    console.log(`  ${r.title} (${r.author ?? "no author"}) owned=${r.owned} pages=${r.page_count ?? "--"}`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Existing tbr rows: ${tbrRows.length}`);
  console.log(`  -> owned updated: ${ownedUpdates.length}`);
  console.log(`  -> left Unsorted (owned stays null): ${unsortedCount}`);
  console.log(`New tbr rows to add: ${newRows.length}`);
  console.log(`Book-table anomalies (not added, review manually): ${bookAnomalies.length}`);
  console.log(`date_finished to fill: ${dateUpdates.length}`);
  console.log(`review to fill: ${reviewUpdates.length}`);
  console.log(`Books that already had a review (should be 0): ${alreadyHadReview.length}`);
  console.log(`Author mismatches on title-only matches (excluded, please review): ${authorMismatches.length}`);

  if (!WRITE) {
    console.log("\nDry run only -- re-run with --write to apply.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const u of dateUpdates) {
      await client.query(
        `update books set date_finished = $1 where book_id = $2 and date_finished is null`,
        [u.date_finished, u.book_id]
      );
    }
    for (const u of reviewUpdates) {
      await client.query(`update books set review = $1 where book_id = $2 and review is null`, [
        u.review,
        u.book_id,
      ]);
    }
    for (const u of ownedUpdates) {
      await client.query(`update tbr set owned = $1 where id = $2`, [u.to, u.id]);
    }
    for (const r of newRows) {
      await client.query(
        `insert into tbr (title, author, owned, page_count) values ($1, $2, $3, $4)`,
        [r.title, r.author, r.owned, r.page_count]
      );
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
