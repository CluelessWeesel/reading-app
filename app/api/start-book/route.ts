import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { resolveAuthorId } from "@/app/shared/resolveAuthorId";

const FORMAT_TYPES = new Set(["audio", "physical", "ebook"]);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { source, tbrId, title, author, genre, subgenre, cover_url, format_type, word_count, page_count, date_started } =
    body as Record<string, unknown>;

  if (typeof format_type !== "string" || !FORMAT_TYPES.has(format_type)) {
    return NextResponse.json({ error: "Format type must be audio, physical, or ebook." }, { status: 400 });
  }
  // The client's own local calendar date -- see app/api/log/route.ts for why
  // Postgres's current_date (UTC on Supabase) is wrong for a timezone ahead
  // of UTC.
  if (typeof date_started !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date_started)) {
    return NextResponse.json({ error: "Expected date_started in YYYY-MM-DD format." }, { status: 400 });
  }
  if (word_count != null && (!isFiniteNumber(word_count) || word_count < 0)) {
    return NextResponse.json({ error: "Word count must be a non-negative number." }, { status: 400 });
  }
  if (page_count != null && (!isFiniteNumber(page_count) || !Number.isInteger(page_count) || page_count <= 0)) {
    return NextResponse.json({ error: "Page count must be a positive whole number." }, { status: 400 });
  }
  if (source !== "tbr" && source !== "new") {
    return NextResponse.json({ error: "source must be 'tbr' or 'new'." }, { status: 400 });
  }
  if (source === "new" && (typeof title !== "string" || !title.trim())) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let bookTitle: string;
    let bookAuthor: string | null;
    let bookGenre: string | null;
    let bookSubgenre: string | null;
    let bookCoverUrl: string | null;
    let bookWordCount: number | null;
    let bookPageCount: number | null;
    let tbrIdNum: number | null = null;
    // Carried silently onto the book row -- never touched by anything in
    // this request/response, so the client never sees the value it's
    // relaying. predicted_at travels with it verbatim (not re-stamped),
    // since "how long ago the call was made" measures from the real
    // TBR-stage entry, not from today's start date.
    let predictedScore: number | null = null;
    let predictedMargin: number | null = null;
    let predictedAt: string | null = null;
    // Carried from the tbr row, same as predicted_*/genre/etc above -- an
    // answer already given at TBR stage (including a deliberate "found it
    // myself", which still stamps gateway_checked_at) shouldn't have to be
    // given again once the book is started.
    let gatewayBookId: number | null = null;
    let gatewayPerson: string | null = null;
    let gatewaySource: string | null = null;
    let gatewayNote: string | null = null;
    let gatewayCheckedAt: string | null = null;

    if (source === "tbr") {
      tbrIdNum = Number(tbrId);
      if (!Number.isInteger(tbrIdNum)) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Invalid TBR id." }, { status: 400 });
      }
      const { rows } = await client.query(
        `select title, author, genre, subgenre, cover_url, author_id, word_count, page_count,
                predicted_score::float8 as predicted_score, predicted_margin::float8 as predicted_margin,
                to_char(predicted_at, 'YYYY-MM-DD"T"HH24:MI:SS') as predicted_at,
                gateway_book_id, gateway_person, gateway_source, gateway_note,
                to_char(gateway_checked_at, 'YYYY-MM-DD"T"HH24:MI:SS') as gateway_checked_at
         from tbr where id = $1`,
        [tbrIdNum]
      );
      if (rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "TBR entry not found." }, { status: 404 });
      }
      bookTitle = rows[0].title;
      bookAuthor = rows[0].author;
      bookGenre = rows[0].genre;
      bookSubgenre = rows[0].subgenre;
      bookCoverUrl = rows[0].cover_url;
      bookWordCount = word_count != null ? (word_count as number) : rows[0].word_count;
      bookPageCount = page_count != null ? (page_count as number) : rows[0].page_count;
      predictedScore = rows[0].predicted_score;
      predictedMargin = rows[0].predicted_margin;
      predictedAt = rows[0].predicted_at;
      gatewayBookId = rows[0].gateway_book_id;
      gatewayPerson = rows[0].gateway_person;
      gatewaySource = rows[0].gateway_source;
      gatewayNote = rows[0].gateway_note;
      gatewayCheckedAt = rows[0].gateway_checked_at;
    } else {
      // genre/subgenre/cover_url are only ever populated by the BookCombobox
      // "search your library" path in StartBookModal (prefilled from an
      // existing books row); the plain-text manual-entry path never sends
      // them, same as before.
      bookTitle = (title as string).trim();
      bookAuthor = typeof author === "string" ? author.trim() || null : null;
      bookGenre = typeof genre === "string" ? genre : null;
      bookSubgenre = typeof subgenre === "string" ? subgenre : null;
      bookCoverUrl = typeof cover_url === "string" ? cover_url : null;
      bookWordCount = word_count != null ? (word_count as number) : null;
      bookPageCount = page_count != null ? (page_count as number) : null;
    }

    // Resolved fresh from the author name every time (rather than trusting
    // tbr.author_id, which can itself be unlinked) -- see resolveAuthorId.
    const bookAuthorId = await resolveAuthorId(client, bookAuthor);

    const { rows: bookRows } = await client.query(
      `insert into books (title, author, genre, subgenre, cover_url, author_id, format_type, word_count, page_count, status, date_started, reread, predicted_score, predicted_margin, predicted_at, gateway_book_id, gateway_person, gateway_source, gateway_note, gateway_checked_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'reading', $10, false, $11, $12, $13, $14, $15, $16, $17, $18)
       returning book_id`,
      [
        bookTitle,
        bookAuthor,
        bookGenre,
        bookSubgenre,
        bookCoverUrl,
        bookAuthorId,
        format_type,
        bookWordCount,
        bookPageCount,
        date_started,
        predictedScore,
        predictedMargin,
        predictedAt,
        gatewayBookId,
        gatewayPerson,
        gatewaySource,
        gatewayNote,
        gatewayCheckedAt,
      ]
    );
    const bookId = bookRows[0].book_id;

    await client.query(`insert into current_books (book_id, position) values ($1, 0)`, [bookId]);

    if (tbrIdNum !== null) {
      await client.query(`delete from tbr where id = $1`, [tbrIdNum]);
    }

    await client.query("COMMIT");
    return NextResponse.json({ book_id: bookId, tbr_id_removed: tbrIdNum }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err && typeof err === "object" && "code" in err) {
      if (err.code === "23503") {
        return NextResponse.json({ error: "That genre doesn't exist in the genres table." }, { status: 400 });
      }
      if (err.code === "23514") {
        return NextResponse.json({ error: "That gateway combination isn't allowed." }, { status: 400 });
      }
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to start book." }, { status: 500 });
  } finally {
    client.release();
  }
}
