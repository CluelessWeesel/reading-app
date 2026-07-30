import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Dedicated, minimal endpoint -- unlike the general PATCH /api/books/[bookId]
// (which requires resending the whole book), this only ever touches the
// gateway columns. Used by backfill triage, where the UI intentionally shows
// (and knows about) nothing else. Every call here is itself a genuine
// answer -- including "found it myself" (all three null) -- so
// gateway_checked_at is always stamped via coalesce, same "set once, never
// bumped again" rule as the general PATCH route.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  const bookIdNum = Number(bookId);
  if (!Number.isInteger(bookIdNum)) {
    return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { gateway_book_id, gateway_person, gateway_source, gateway_note } = body as Record<string, unknown>;

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

  try {
    const { rows } = await pool.query(
      `update books as b set
         gateway_book_id = $1, gateway_person = $2, gateway_source = $3, gateway_note = $4,
         gateway_checked_at = coalesce(b.gateway_checked_at, now())
       where b.book_id = $5
       returning b.book_id, b.gateway_book_id, b.gateway_person, b.gateway_source, b.gateway_note,
         to_char(b.gateway_checked_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as gateway_checked_at`,
      [
        typeof gateway_book_id === "number" ? gateway_book_id : null,
        typeof gateway_person === "string" ? gateway_person.trim() || null : null,
        typeof gateway_source === "string" ? gateway_source.trim() || null : null,
        typeof gateway_note === "string" ? gateway_note.trim() || null : null,
        bookIdNum,
      ]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) {
      if (err.code === "P0001" && "message" in err && typeof err.message === "string") {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      if (err.code === "23514") {
        return NextResponse.json({ error: "That gateway combination isn't allowed." }, { status: 400 });
      }
    }
    console.error(err);
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
}
