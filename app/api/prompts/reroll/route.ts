import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const bookId = Number((body as Record<string, unknown> | null)?.bookId);
  const excludeIds = (body as Record<string, unknown> | null)?.excludeIds;
  if (!Number.isInteger(bookId) || !Array.isArray(excludeIds)) {
    return NextResponse.json({ error: "Expected { bookId, excludeIds: [] }" }, { status: 400 });
  }
  const excludeIdsNum = excludeIds.map(Number).filter(Number.isInteger);

  const { rows } = await pool.query(
    `select id, question
     from prompts
     where active
       and id not in (select prompt_id from prompt_answers where book_id = $1)
       and id != all($2::bigint[])
     order by random()
     limit 1`,
    [bookId, excludeIdsNum]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "No other prompts available." }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
