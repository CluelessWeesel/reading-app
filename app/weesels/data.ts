import { pool } from "@/lib/db";
import type { HonourItem } from "../shared/HonourBadge";
import type { WeeselCategory, WeeselRow } from "./types";

export async function getCategories(): Promise<WeeselCategory[]> {
  const { rows } = await pool.query<WeeselCategory>(
    `select id::int as id, name, prestige_order, rereads_eligible, min_candidates, active
     from weesel_categories
     order by prestige_order asc`
  );
  return rows;
}

export async function getSealedYears(): Promise<Set<number>> {
  const { rows } = await pool.query<{ year: number }>(`select year from weesel_years`);
  return new Set(rows.map((r) => r.year));
}

export type Amendment = {
  id: number;
  category_id: number | null;
  category_name: string | null;
  reason: string;
  amended_at: string;
};

export async function getAmendments(year: number): Promise<Amendment[]> {
  const { rows } = await pool.query<Amendment>(
    `select a.id::int as id, a.category_id::int as category_id, wc.name as category_name, a.reason,
            to_char(a.amended_at, 'YYYY-MM-DD HH24:MI') as amended_at
     from weesel_amendments a
     left join weesel_categories wc on wc.id = a.category_id
     where a.year = $1
     order by a.amended_at desc`,
    [year]
  );
  return rows;
}

// Every book-linked weesels row, grouped by book_id -- the shape
// HonourBadge (app/shared/HonourBadge.tsx) expects, reused everywhere a
// book or its author's honours surface (rankings rows, book/author headers,
// home).
export async function getAllBookHonours(): Promise<Map<number, HonourItem[]>> {
  const { rows } = await pool.query<{ book_id: number; year: number; category: string; result: "winner" | "nominee" }>(
    `select w.book_id, w.year, wc.name as category, w.result
     from weesels w
     join weesel_categories wc on wc.id = w.category_id
     where w.book_id is not null
     order by w.year desc`
  );
  const map = new Map<number, HonourItem[]>();
  for (const r of rows) {
    if (!map.has(r.book_id)) map.set(r.book_id, []);
    map.get(r.book_id)!.push({ year: r.year, category: r.category, result: r.result });
  }
  return map;
}

// Every weesels row, with the book resolved where book_id is set, and an
// author_id resolved wherever possible -- via the book's actual author
// (authoritative, and the only way to avoid crediting a narrator for Best
// Narration), or by matching the free-text nominee/author_or_narrator
// fields against the authors table by exact name for the categories that
// don't have a book_id at all (Author of the Year, Best New Author, Most
// Anticipated Author credit the nominee itself; Best Series credits
// author_or_narrator). See weeselMath.ts for how these are chosen per row.
export async function getWeeselRows(): Promise<WeeselRow[]> {
  const { rows } = await pool.query<WeeselRow>(
    `select w.id::int as id, w.year, w.category_id::int as category_id, w.book_id, w.nominee, w.author_or_narrator,
            w.result, w.citation,
            b.title as book_title, b.cover_url, b.author as book_author, b.author_id::int as book_author_id,
            b.genre as book_genre, b.format_type as book_format_type,
            a2.id::int as nominee_author_id, a3.id::int as author_or_narrator_author_id
     from weesels w
     left join books b on b.book_id = w.book_id
     left join authors a2 on a2.name = w.nominee
     left join authors a3 on a3.name = w.author_or_narrator
     order by w.year asc, w.id asc`
  );
  return rows;
}
