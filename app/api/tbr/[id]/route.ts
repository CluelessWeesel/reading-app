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

  const {
    title,
    author,
    genre,
    subgenre,
    word_count,
    page_count,
    owned_or_format,
    owned,
    library_uni,
    library_other,
    gateway_book_id,
    gateway_person,
    gateway_source,
    gateway_note,
    gateway_touched,
  } = body as Record<string, unknown>;

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
  if (library_uni != null && typeof library_uni !== "boolean") {
    return NextResponse.json({ error: "library_uni must be a boolean, or omitted." }, { status: 400 });
  }
  if (library_other != null && typeof library_other !== "boolean") {
    return NextResponse.json({ error: "library_other must be a boolean, or omitted." }, { status: 400 });
  }
  if (gateway_book_id != null && (typeof gateway_book_id !== "number" || !Number.isInteger(gateway_book_id))) {
    return NextResponse.json({ error: "Gateway book id must be a whole number, or omitted." }, { status: 400 });
  }
  if (gateway_person != null && (typeof gateway_person !== "string" || !gateway_person.trim())) {
    return NextResponse.json({ error: "Gateway person must be a non-empty string, or omitted." }, { status: 400 });
  }
  if (gateway_source != null && (typeof gateway_source !== "string" || !gateway_source.trim())) {
    return NextResponse.json({ error: "Gateway source must be a non-empty string, or omitted." }, { status: 400 });
  }
  if (gateway_note != null && (typeof gateway_note !== "string" || !gateway_note.trim())) {
    return NextResponse.json({ error: "Gateway note must be a non-empty string, or omitted." }, { status: 400 });
  }
  const gatewayFieldsSet = [gateway_book_id, gateway_person, gateway_source].filter((v) => v != null).length;
  if (gatewayFieldsSet > 1) {
    return NextResponse.json(
      { error: "A gateway can be a book, a person, or a source -- only one at a time." },
      { status: 400 }
    );
  }

  const authorVal = typeof author === "string" ? author.trim() || null : null;
  const genreVal = typeof genre === "string" ? genre.trim() || null : null;
  const subgenreVal = typeof subgenre === "string" ? subgenre.trim() || null : null;
  const ownedFormatVal = typeof owned_or_format === "string" ? owned_or_format.trim() || null : null;
  const nextOwned: boolean | null = typeof owned === "boolean" ? owned : null;
  const libraryUniVal = library_uni === true;
  const libraryOtherVal = library_other === true;
  const gatewayBookIdVal = typeof gateway_book_id === "number" ? gateway_book_id : null;
  const gatewayPersonVal = typeof gateway_person === "string" ? gateway_person.trim() || null : null;
  const gatewaySourceVal = typeof gateway_source === "string" ? gateway_source.trim() || null : null;
  const gatewayNoteVal = typeof gateway_note === "string" ? gateway_note.trim() || null : null;
  const gatewayTouched = gateway_touched === true;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existingRows } = await client.query<{ owned: boolean | null }>(
      `select owned from tbr where id = $1 for update`,
      [idNum]
    );
    if (existingRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    const previousOwned = existingRows[0].owned;

    // owned/unowned each track their own "date added to this shelf" --
    // stamped only on an actual transition into that state, not on every
    // save of the entry (which would otherwise reset it every time an
    // unrelated field like genre or page count gets edited).
    const stampOwnedAddedAt = nextOwned === true && previousOwned !== true;
    const stampUnownedAddedAt = nextOwned === false && previousOwned !== false;

    const { rows } = await client.query(
      `update tbr as t set title = $1, author = $2, genre = $3, subgenre = $4, word_count = $5, owned_or_format = $6,
         page_count = $7, owned = $8,
         owned_added_at = case when $9 then now() else t.owned_added_at end,
         unowned_added_at = case when $10 then now() else t.unowned_added_at end,
         gateway_book_id = $11, gateway_person = $12, gateway_source = $13, gateway_note = $14,
         gateway_checked_at = case when $15 then coalesce(t.gateway_checked_at, now()) else t.gateway_checked_at end,
         library_uni = $16, library_other = $17
       where t.id = $18
       returning t.id, t.title, t.author, t.genre, t.subgenre, t.word_count, t.page_count, t.owned_or_format,
         t.cover_url, t.owned, t.library_uni, t.library_other,
         to_char(t.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
         to_char(t.owned_added_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as owned_added_at,
         to_char(t.unowned_added_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as unowned_added_at,
         t.gateway_book_id, t.gateway_person, t.gateway_source, t.gateway_note,
         to_char(t.gateway_checked_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as gateway_checked_at,
         (select gb.title from books gb where gb.book_id = t.gateway_book_id) as gateway_book_title,
         (select gb.author from books gb where gb.book_id = t.gateway_book_id) as gateway_book_author,
         (select gb.cover_url from books gb where gb.book_id = t.gateway_book_id) as gateway_book_cover_url`,
      [
        title.trim(),
        authorVal,
        genreVal,
        subgenreVal,
        word_count ?? null,
        ownedFormatVal,
        page_count ?? null,
        nextOwned,
        stampOwnedAddedAt,
        stampUnownedAddedAt,
        gatewayBookIdVal,
        gatewayPersonVal,
        gatewaySourceVal,
        gatewayNoteVal,
        gatewayTouched,
        libraryUniVal,
        libraryOtherVal,
        idNum,
      ]
    );

    await client.query("COMMIT");
    return NextResponse.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err && typeof err === "object" && "code" in err) {
      if (err.code === "23503") {
        return NextResponse.json({ error: "That genre doesn't exist in the genres table." }, { status: 400 });
      }
      if (err.code === "23505") {
        return NextResponse.json({ error: "A TBR entry with this title already exists." }, { status: 400 });
      }
      if (err.code === "23514") {
        return NextResponse.json({ error: "That gateway combination isn't allowed." }, { status: 400 });
      }
    }
    console.error(err);
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  } finally {
    client.release();
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
