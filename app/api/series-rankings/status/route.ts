import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { SERIES_LIST_NAMES, STATUS_FLAGS } from "@/app/rankings/types";

// Editing status_flag is independent of rank -- a series can flip between
// Complete/Not Complete/Unpublished at any time as the user's situation
// changes, with no effect on its position. Not a rank change, so this never
// touches series_rank_changes (mirrors how book_rankings' other fields like
// score/had_star aren't logged either -- only rank moves are).
export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { list_name, series, status_flag } = body as Record<string, unknown>;

  if (typeof list_name !== "string" || !SERIES_LIST_NAMES.includes(list_name as (typeof SERIES_LIST_NAMES)[number])) {
    return NextResponse.json({ error: "Invalid list_name." }, { status: 400 });
  }
  if (typeof series !== "string" || !series.trim()) {
    return NextResponse.json({ error: "series is required." }, { status: 400 });
  }
  if (typeof status_flag !== "string" || !STATUS_FLAGS.includes(status_flag as (typeof STATUS_FLAGS)[number])) {
    return NextResponse.json({ error: "Invalid status_flag." }, { status: 400 });
  }

  try {
    const { rowCount } = await pool.query(
      `update series_rankings set status_flag = $1 where list_name = $2 and series = $3`,
      [status_flag, list_name, series]
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: "Series is not in that list." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update status." }, { status: 500 });
  }
}
