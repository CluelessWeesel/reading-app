import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Answers are optional per prompt -- only non-empty ones are sent/saved.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  const { bookId } = await params;
  const bookIdNum = Number(bookId);
  if (!Number.isInteger(bookIdNum)) {
    return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray((body as Record<string, unknown>).answers)) {
    return NextResponse.json({ error: "Expected { answers: [...] }" }, { status: 400 });
  }
  const answers = (body as { answers: unknown[] }).answers;

  for (const raw of answers) {
    const a = raw as Record<string, unknown>;
    if (!Number.isInteger(Number(a.prompt_id)) || typeof a.answer !== "string" || !a.answer.trim()) {
      return NextResponse.json(
        { error: "Each answer needs a prompt_id and non-empty answer text." },
        { status: 400 }
      );
    }
  }

  try {
    for (const raw of answers) {
      const a = raw as { prompt_id: number; answer: string };
      await pool.query(
        `insert into prompt_answers (book_id, prompt_id, answer)
         values ($1, $2, $3)
         on conflict (book_id, prompt_id) do update set answer = excluded.answer, answered_at = now()`,
        [bookIdNum, Number(a.prompt_id), a.answer.trim()]
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
}
