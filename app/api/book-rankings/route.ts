import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// list_id maps 1:1 to a year in the existing data (list_1=2023, list_2=2024,
// etc.) but that's not stored anywhere explicit -- resolved by lookup here,
// with a fresh "year-<Y>" id minted the first time a brand new year gets a
// ranked entry.
export async function GET(request: NextRequest) {
  const year = Number(request.nextUrl.searchParams.get("year"));
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: "year query param is required." }, { status: 400 });
  }

  const { rows: listRows } = await pool.query(
    `select distinct list_id from book_rankings where year = $1 limit 1`,
    [year]
  );
  const listId: string | null = listRows[0]?.list_id ?? null;

  if (!listId) {
    return NextResponse.json({ list_id: null, rankings: [] });
  }

  const { rows } = await pool.query(
    `select rank, title, book_id, score::float8 as score, had_star
     from book_rankings where list_id = $1 order by rank asc`,
    [listId]
  );
  return NextResponse.json({ list_id: listId, rankings: rows });
}
