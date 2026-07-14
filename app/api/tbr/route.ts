import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// Lets any page (not just /tbr's own server-fetched data) search TBR
// entries -- used by the "start a book" flow's TBR search.
export async function GET() {
  const { rows } = await pool.query(
    `select id, title, author, owned_or_format, subgenre, genre, word_count, page_count, cover_url, owned,
            to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
     from tbr
     order by title asc`
  );
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { title, author, genre, subgenre, word_count, page_count, owned_or_format, owned } = body as Record<
    string,
    unknown
  >;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (word_count != null && (!isFiniteNumber(word_count) || !Number.isInteger(word_count) || word_count < 0)) {
    return NextResponse.json({ error: "Word count must be a non-negative whole number." }, { status: 400 });
  }
  if (page_count != null && (!isFiniteNumber(page_count) || !Number.isInteger(page_count) || page_count < 0)) {
    return NextResponse.json({ error: "Page count must be a non-negative whole number." }, { status: 400 });
  }
  if (genre != null && (typeof genre !== "string" || !genre.trim())) {
    return NextResponse.json({ error: "Genre must be a non-empty string, or omitted." }, { status: 400 });
  }
  if (owned != null && typeof owned !== "boolean") {
    return NextResponse.json({ error: "Owned must be true, false, or omitted." }, { status: 400 });
  }

  const authorVal = typeof author === "string" ? author.trim() || null : null;
  const genreVal = typeof genre === "string" ? genre.trim() || null : null;
  const subgenreVal = typeof subgenre === "string" ? subgenre.trim() || null : null;
  const ownedFormatVal = typeof owned_or_format === "string" ? owned_or_format.trim() || null : null;

  try {
    const { rows } = await pool.query(
      `insert into tbr (title, author, genre, subgenre, word_count, page_count, owned_or_format, owned)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, title, author, genre, subgenre, word_count, page_count, owned_or_format, cover_url, owned,
         to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at`,
      [title.trim(), authorVal, genreVal, subgenreVal, word_count ?? null, page_count ?? null, ownedFormatVal, owned ?? null]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      if (err.code === "23503") {
        return NextResponse.json({ error: "That genre doesn't exist in the genres table." }, { status: 400 });
      }
      if (err.code === "23505") {
        return NextResponse.json({ error: "A TBR entry with this title already exists." }, { status: 400 });
      }
    }
    console.error(err);
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
}
