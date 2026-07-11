import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { title, author, genre, subgenre, word_count, owned_or_format } = body as Record<string, unknown>;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (word_count != null && (!isFiniteNumber(word_count) || !Number.isInteger(word_count) || word_count < 0)) {
    return NextResponse.json({ error: "Word count must be a non-negative whole number." }, { status: 400 });
  }
  if (genre != null && (typeof genre !== "string" || !genre.trim())) {
    return NextResponse.json({ error: "Genre must be a non-empty string, or omitted." }, { status: 400 });
  }

  const authorVal = typeof author === "string" ? author.trim() || null : null;
  const genreVal = typeof genre === "string" ? genre.trim() || null : null;
  const subgenreVal = typeof subgenre === "string" ? subgenre.trim() || null : null;
  const ownedFormatVal = typeof owned_or_format === "string" ? owned_or_format.trim() || null : null;

  try {
    const { rows, rowCount } = await pool.query(
      `update tbr set title = $1, author = $2, genre = $3, subgenre = $4, word_count = $5, owned_or_format = $6
       where id = $7
       returning id, title, author, genre, subgenre, word_count, owned_or_format, cover_url,
         to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at`,
      [title.trim(), authorVal, genreVal, subgenreVal, word_count ?? null, ownedFormatVal, idNum]
    );

    if (rowCount === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { rowCount } = await pool.query(`delete from tbr where id = $1`, [idNum]);
  if (rowCount === 0) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  return NextResponse.json({ id: idNum });
}
