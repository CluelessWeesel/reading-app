import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const bookId = Number(request.nextUrl.searchParams.get("bookId"));
  if (!Number.isInteger(bookId)) {
    return NextResponse.json({ error: "bookId query param is required." }, { status: 400 });
  }

  const { rows } = await pool.query(
    `select id, question
     from prompts
     where active
       and id not in (select prompt_id from prompt_answers where book_id = $1)
     order by random()
     limit 5`,
    [bookId]
  );
  return NextResponse.json(rows);
}
