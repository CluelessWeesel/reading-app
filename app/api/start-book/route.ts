import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

const FORMAT_TYPES = new Set(["audio", "physical", "ebook"]);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { source, tbrId, title, author, format_type, word_count, page_count } =
    body as Record<string, unknown>;

  if (typeof format_type !== "string" || !FORMAT_TYPES.has(format_type)) {
    return NextResponse.json({ error: "Format type must be audio, physical, or ebook." }, { status: 400 });
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
    let bookWordCount: number | null;
    let tbrIdNum: number | null = null;

    if (source === "tbr") {
      tbrIdNum = Number(tbrId);
      if (!Number.isInteger(tbrIdNum)) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Invalid TBR id." }, { status: 400 });
      }
      const { rows } = await client.query(
        `select title, author, genre, word_count from tbr where id = $1`,
        [tbrIdNum]
      );
      if (rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "TBR entry not found." }, { status: 404 });
      }
      bookTitle = rows[0].title;
      bookAuthor = rows[0].author;
      bookGenre = rows[0].genre;
      bookWordCount = word_count != null ? (word_count as number) : rows[0].word_count;
    } else {
      bookTitle = (title as string).trim();
      bookAuthor = typeof author === "string" ? author.trim() || null : null;
      bookGenre = null;
      bookWordCount = word_count != null ? (word_count as number) : null;
    }

    const { rows: bookRows } = await client.query(
      `insert into books (title, author, genre, format_type, word_count, page_count, status, date_started, reread)
       values ($1, $2, $3, $4, $5, $6, 'reading', current_date, false)
       returning book_id`,
      [bookTitle, bookAuthor, bookGenre, format_type, bookWordCount, page_count ?? null]
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
    if (err && typeof err === "object" && "code" in err && err.code === "23503") {
      return NextResponse.json({ error: "That genre doesn't exist in the genres table." }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to start book." }, { status: 500 });
  } finally {
    client.release();
  }
}
