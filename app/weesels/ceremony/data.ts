import { pool } from "@/lib/db";
import type { WeeselCategory } from "../types";
import type { AuthorOption, CategoryStatus, ConfirmedNominee, WatchedSuggestion, YearFinishedBook } from "./types";

export async function getYearFinishedBooks(year: number): Promise<YearFinishedBook[]> {
  const { rows } = await pool.query<YearFinishedBook>(
    `select b.book_id, b.title, b.author, b.author_id::int as author_id, a.photo_url as author_photo_url,
            b.cover_url, b.genre, b.subgenre, b.reread, b.indie, b.format_type, b.narrator, b.series,
            to_char(b.date_finished, 'YYYY-MM-DD') as date_finished
     from books b
     left join authors a on a.id = b.author_id
     where b.date_finished is not null and extract(year from b.date_finished)::int = $1
     order by b.date_finished asc`,
    [year]
  );
  return rows;
}

// An author counts as "first read this year" if their earliest finish ever
// (across all years) falls within this year -- not just their earliest
// finish among this year's books, which every author would trivially match.
export async function getAuthorsFirstReadThisYear(year: number): Promise<AuthorOption[]> {
  const { rows } = await pool.query<AuthorOption>(
    `select a.id::int as author_id, a.name, a.photo_url
     from authors a
     where exists (
       select 1 from books b
       where b.author_id = a.id and b.date_finished is not null and extract(year from b.date_finished)::int = $1
     )
     and (
       select min(b2.date_finished) from books b2 where b2.author_id = a.id and b2.date_finished is not null
     ) >= make_date($1, 1, 1)
     order by a.name asc`,
    [year]
  );
  return rows;
}

// Every "Weesels watch?" flag for books finished this year, grouped by
// category -- used both to pre-star already-included candidates and to
// surface watched books the eligibility engine didn't auto-include.
export async function getWatchlistByCategory(
  year: number
): Promise<Map<number, WatchedSuggestion[]>> {
  const { rows } = await pool.query<{
    category_id: number;
    book_id: number;
    title: string;
    author: string | null;
    cover_url: string | null;
  }>(
    `select w.category_id::int as category_id, b.book_id, b.title, b.author, b.cover_url
     from weesel_watchlist w
     join books b on b.book_id = w.book_id
     where b.date_finished is not null and extract(year from b.date_finished)::int = $1
     order by b.title asc`,
    [year]
  );
  const map = new Map<number, WatchedSuggestion[]>();
  for (const r of rows) {
    if (!map.has(r.category_id)) map.set(r.category_id, []);
    map.get(r.category_id)!.push({ bookId: r.book_id, title: r.title, author: r.author, coverUrl: r.cover_url });
  }
  return map;
}

export type WatchedShortlistEntry = {
  bookId: number;
  title: string;
  coverUrl: string | null;
  categoryNames: string[];
};

// Same underlying data as getWatchlistByCategory, grouped by book instead
// of by category -- the season tracker's "here's what you've been
// shortlisting" view.
export async function getWatchedShortlist(year: number): Promise<WatchedShortlistEntry[]> {
  const { rows } = await pool.query<{ book_id: number; title: string; cover_url: string | null; category_name: string }>(
    `select b.book_id, b.title, b.cover_url, wc.name as category_name
     from weesel_watchlist w
     join books b on b.book_id = w.book_id
     join weesel_categories wc on wc.id = w.category_id
     where b.date_finished is not null and extract(year from b.date_finished)::int = $1
     order by b.title asc`,
    [year]
  );
  const byBook = new Map<number, WatchedShortlistEntry>();
  for (const r of rows) {
    if (!byBook.has(r.book_id)) {
      byBook.set(r.book_id, { bookId: r.book_id, title: r.title, coverUrl: r.cover_url, categoryNames: [] });
    }
    byBook.get(r.book_id)!.categoryNames.push(r.category_name);
  }
  return Array.from(byBook.values());
}

export async function getAllAuthors(): Promise<AuthorOption[]> {
  const { rows } = await pool.query<AuthorOption>(
    `select id::int as author_id, name, photo_url from authors order by name asc`
  );
  return rows;
}

type WeeselRowWithLookups = {
  id: number;
  category_id: number | null;
  book_id: number | null;
  nominee: string;
  author_or_narrator: string | null;
  result: "winner" | "nominee";
  citation: string | null;
  cover_url: string | null;
  book_title: string | null;
  book_author_id: number | null;
  book_author_photo_url: string | null;
  nominee_author_id: number | null;
  nominee_author_photo_url: string | null;
};

function toConfirmedNominee(r: WeeselRowWithLookups): ConfirmedNominee {
  return {
    weeselId: r.id,
    label: r.book_title ?? r.nominee,
    sublabel: r.author_or_narrator,
    bookId: r.book_id,
    authorId: r.book_author_id ?? r.nominee_author_id ?? null,
    coverUrl: r.cover_url,
    photoUrl: r.book_author_photo_url ?? r.nominee_author_photo_url ?? null,
  };
}

// Derives every category's ceremony status purely from weesel_ceremony_progress
// (has it been reviewed) and weesels rows for the year (its confirmed pool
// and, once set, its winner) -- no separate "phase" is stored anywhere.
export async function getCategoryStatuses(
  year: number,
  categories: WeeselCategory[]
): Promise<Map<number, CategoryStatus>> {
  const [{ rows: progressRows }, { rows: weeselRows }] = await Promise.all([
    pool.query<{ category_id: number }>(
      `select category_id::int as category_id from weesel_ceremony_progress where year = $1`,
      [year]
    ),
    pool.query<WeeselRowWithLookups>(
      `select w.id::int as id, w.category_id::int as category_id, w.book_id, w.nominee, w.author_or_narrator,
              w.result, w.citation,
              b.cover_url, b.title as book_title,
              b.author_id::int as book_author_id, ba.photo_url as book_author_photo_url,
              na.id::int as nominee_author_id, na.photo_url as nominee_author_photo_url
       from weesels w
       left join books b on b.book_id = w.book_id
       left join authors ba on ba.id = b.author_id
       left join authors na on na.name = w.nominee
       where w.year = $1
       order by w.id asc`,
      [year]
    ),
  ]);

  const confirmedCategoryIds = new Set(progressRows.map((r) => r.category_id));
  const byCategory = new Map<number, WeeselRowWithLookups[]>();
  for (const r of weeselRows) {
    if (r.category_id == null) continue;
    if (!byCategory.has(r.category_id)) byCategory.set(r.category_id, []);
    byCategory.get(r.category_id)!.push(r);
  }

  const statuses = new Map<number, CategoryStatus>();
  for (const c of categories) {
    if (!confirmedCategoryIds.has(c.id)) {
      statuses.set(c.id, { state: "unreviewed" });
      continue;
    }
    const rows = byCategory.get(c.id) ?? [];
    if (rows.length === 0) {
      statuses.set(c.id, { state: "confirmed-not-running" });
      continue;
    }
    const nominees = rows.map(toConfirmedNominee);
    const winnerRow = rows.find((r) => r.result === "winner");
    if (winnerRow) {
      statuses.set(c.id, {
        state: "revealed",
        nominees,
        winner: toConfirmedNominee(winnerRow),
        citation: winnerRow.citation,
      });
    } else {
      statuses.set(c.id, { state: "confirmed-running", nominees });
    }
  }
  return statuses;
}
