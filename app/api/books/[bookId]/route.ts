import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { todayLocalIso } from "@/app/shared/isoDate";
import { classifyYearEdit } from "@/app/shared/adjustmentWindow";
import { ADJUSTMENT_LIMIT, getAdjustmentUsedBookIds } from "@/app/shared/adjustmentBudget";
import { resolveAuthorId } from "@/app/shared/resolveAuthorId";

const FORMAT_TYPES = new Set(["audio", "physical", "ebook"]);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// Only title is required. author/genre/format_raw/format_type/page_count/
// year_read are nullable at the DB level -- a currently-reading book (from
// the "start a book" flow) legitimately has these unset until it's
// finished, so each is validated only when provided, not required outright.
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

  const {
    title,
    author,
    series,
    series_number,
    genre,
    subgenre,
    year_released,
    year_read,
    score,
    format_raw,
    format_type,
    word_count,
    page_count,
    narrator,
    reread,
    date_started,
    date_finished,
    isbn,
    status,
    review,
    predicted_score,
    predicted_margin,
    reason,
    historicalConfirmed,
  } = body as Record<string, unknown>;

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }
  if (author != null && (typeof author !== "string" || !author.trim())) {
    return NextResponse.json({ error: "Author must be a non-empty string, or omitted." }, { status: 400 });
  }
  if (genre != null && (typeof genre !== "string" || !genre.trim())) {
    return NextResponse.json({ error: "Genre must be a non-empty string, or omitted." }, { status: 400 });
  }
  if (format_raw != null && (typeof format_raw !== "string" || !format_raw.trim())) {
    return NextResponse.json({ error: "Format (raw) must be a non-empty string, or omitted." }, { status: 400 });
  }
  if (format_type != null && (typeof format_type !== "string" || !FORMAT_TYPES.has(format_type))) {
    return NextResponse.json({ error: "Format type must be audio, physical, or ebook." }, { status: 400 });
  }
  if (year_read != null && (!isFiniteNumber(year_read) || !Number.isInteger(year_read))) {
    return NextResponse.json({ error: "Year read must be a whole number." }, { status: 400 });
  }
  if (page_count != null && (!isFiniteNumber(page_count) || !Number.isInteger(page_count) || page_count <= 0)) {
    return NextResponse.json({ error: "Page count must be a positive whole number." }, { status: 400 });
  }
  if (series_number != null && !isFiniteNumber(series_number)) {
    return NextResponse.json({ error: "Series number must be a number." }, { status: 400 });
  }
  if (year_released != null && (!isFiniteNumber(year_released) || !Number.isInteger(year_released))) {
    return NextResponse.json({ error: "Year released must be a whole number." }, { status: 400 });
  }
  if (word_count != null && !isFiniteNumber(word_count)) {
    return NextResponse.json({ error: "Word count must be a number." }, { status: 400 });
  }
  if (score != null) {
    if (!isFiniteNumber(score) || score < 0.5 || score > 5 || Math.round(score * 2) !== score * 2) {
      return NextResponse.json({ error: "Score must be between 0.5 and 5, in steps of 0.5." }, { status: 400 });
    }
  }
  if (subgenre != null && (typeof subgenre !== "string" || !subgenre.trim())) {
    return NextResponse.json({ error: "Subgenre must be a non-empty string, or omitted." }, { status: 400 });
  }
  if (predicted_score != null) {
    if (
      !isFiniteNumber(predicted_score) ||
      predicted_score < 0.5 ||
      predicted_score > 5 ||
      Math.round(predicted_score * 2) !== predicted_score * 2
    ) {
      return NextResponse.json(
        { error: "Predicted score must be between 0.5 and 5, in steps of 0.5." },
        { status: 400 }
      );
    }
  }
  if (predicted_margin != null) {
    if (!isFiniteNumber(predicted_margin) || predicted_margin < 0 || predicted_margin > 4.5) {
      return NextResponse.json({ error: "Predicted margin must be between 0 and 4.5." }, { status: 400 });
    }
  }
  if (
    typeof date_started === "string" &&
    typeof date_finished === "string" &&
    date_started &&
    date_finished &&
    date_started > date_finished
  ) {
    return NextResponse.json({ error: "Date finished can't be before date started." }, { status: 400 });
  }

  const authorVal = typeof author === "string" ? author.trim() || null : null;
  const genreVal = typeof genre === "string" ? genre.trim() || null : null;
  const subgenreVal = typeof subgenre === "string" ? subgenre.trim() || null : null;
  const formatRawVal = typeof format_raw === "string" ? format_raw.trim() || null : null;
  const formatTypeVal = typeof format_type === "string" ? format_type : null;
  const seriesVal = typeof series === "string" ? series.trim() || null : null;
  const narratorVal = typeof narrator === "string" ? narrator.trim() || null : null;
  const isbnVal = typeof isbn === "string" ? isbn.trim() || null : null;
  const statusVal = typeof status === "string" ? status.trim() || null : null;
  const dateStartedVal = typeof date_started === "string" ? date_started || null : null;
  const dateFinishedVal = typeof date_finished === "string" ? date_finished || null : null;
  const reviewVal = typeof review === "string" ? review.trim() || null : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: currentRows } = await client.query<{ score: number | null; year_read: number | null }>(
      `select score::float8 as score, year_read from books where book_id = $1 for update`,
      [bookIdNum]
    );
    if (currentRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    const oldScore = currentRows[0].score;
    const newScoreVal: number | null = score ?? null;
    const scoreChanged = oldScore !== newScoreVal;

    // The score-change gate only applies when the score is actually moving,
    // and is scoped to the book's own year_read -- editing any other field
    // on a past-year book (fixing a typo'd review, say) isn't part of this
    // feature and stays unrestricted.
    if (scoreChanged && currentRows[0].year_read != null) {
      const classification = classifyYearEdit(currentRows[0].year_read, todayLocalIso());
      const reasonVal = typeof reason === "string" ? reason.trim() : "";
      if (classification === "adjustment") {
        if (!reasonVal) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "A short reason is required for an adjustment-window change." },
            { status: 400 }
          );
        }
        const used = await getAdjustmentUsedBookIds(client, currentRows[0].year_read);
        if (!used.has(bookIdNum) && used.size >= ADJUSTMENT_LIMIT) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: `You've already used all ${ADJUSTMENT_LIMIT} adjustments for ${currentRows[0].year_read}.` },
            { status: 403 }
          );
        }
      } else if (classification === "historical" && historicalConfirmed !== true) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            error: `${currentRows[0].year_read} is outside its adjustment window. Confirm to edit its score anyway.`,
            requiresConfirmation: true,
          },
          { status: 409 }
        );
      }
    }

    // Resolved fresh from the author name on every save -- not just at
    // creation -- so an older book that was never linked (or had its author
    // typo-fixed) self-heals the moment its edit form is saved, rather than
    // needing another manual re-run of scripts/backfill-authors.ts.
    const authorIdVal = await resolveAuthorId(client, authorVal);

    const { rows, rowCount } = await client.query(
      `update books set
         title = $1, author = $2, series = $3, series_number = $4, genre = $5,
         year_released = $6, year_read = $7, score = $8, format_raw = $9,
         format_type = $10, word_count = $11, page_count = $12, narrator = $13,
         reread = $14, date_started = $15, date_finished = $16, isbn = $17, status = $18,
         review = $19, subgenre = $20, predicted_score = $21, predicted_margin = $22,
         author_id = $23
       where book_id = $24
       returning
         book_id, title, author, series, genre, subgenre, year_released, year_read,
         format_raw, format_type, page_count, narrator, reread, isbn, status, cover_url,
         review, legacy_notes,
         series_number::float8 as series_number,
         score::float8 as score,
         word_count::float8 as word_count,
         predicted_score::float8 as predicted_score,
         predicted_margin::float8 as predicted_margin,
         to_char(date_started, 'YYYY-MM-DD') as date_started,
         to_char(date_finished, 'YYYY-MM-DD') as date_finished`,
      [
        title.trim(),
        authorVal,
        seriesVal,
        series_number ?? null,
        genreVal,
        year_released ?? null,
        year_read ?? null,
        score ?? null,
        formatRawVal,
        formatTypeVal,
        word_count ?? null,
        page_count ?? null,
        narratorVal,
        Boolean(reread),
        dateStartedVal,
        dateFinishedVal,
        isbnVal,
        statusVal,
        reviewVal,
        subgenreVal,
        predicted_score ?? null,
        predicted_margin ?? null,
        authorIdVal,
        bookIdNum,
      ]
    );

    if (rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (scoreChanged && currentRows[0].year_read != null) {
      const classification = classifyYearEdit(currentRows[0].year_read, todayLocalIso());
      const reasonVal = typeof reason === "string" ? reason.trim() : "";
      await client.query(
        `insert into score_changes (book_id, year, old_score, new_score, reason) values ($1, $2, $3, $4, $5)`,
        [bookIdNum, currentRows[0].year_read, oldScore, newScoreVal, classification === "adjustment" ? reasonVal : null]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json(rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err && typeof err === "object" && "code" in err && err.code === "23503") {
      return NextResponse.json({ error: "That genre doesn't exist in the genres table." }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  } finally {
    client.release();
  }
}

// Deletes the book outright (cascades to current_books, book_ratings, prompt_answers).
// book_rankings has a plain FK with no ON DELETE clause, so any ranking slot for this
// book is removed first, shifting everything below it back up to keep ranks consecutive.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  const bookIdNum = Number(bookId);
  if (!Number.isInteger(bookIdNum)) {
    return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const { rows: rankingRows } = await client.query(
      `delete from book_rankings where book_id = $1 returning list_id, rank`,
      [bookIdNum]
    );
    for (const { list_id, rank } of rankingRows) {
      await client.query(
        `update book_rankings set rank = rank - 1 where list_id = $1 and rank > $2`,
        [list_id, rank]
      );
    }

    const { rowCount } = await client.query(`delete from books where book_id = $1`, [bookIdNum]);
    if (rowCount === 0) {
      await client.query("rollback");
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    await client.query("commit");
    return NextResponse.json({ book_id: bookIdNum });
  } catch (err) {
    await client.query("rollback");
    console.error(err);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  } finally {
    client.release();
  }
}
