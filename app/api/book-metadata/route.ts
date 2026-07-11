import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Genre options (constrained by the genres table FK) and series autocomplete
// suggestions, for edit forms that live outside /library (e.g. the
// Currently Reading panel) and so don't already have this from a server
// component fetch.
export async function GET() {
  const [genres, series] = await Promise.all([
    pool.query<{ genre: string }>(`select genre from genres order by genre asc`),
    pool.query<{ series: string }>(
      `select distinct series from books where series is not null order by series asc`
    ),
  ]);
  return NextResponse.json({
    genres: genres.rows.map((r) => r.genre),
    series: series.rows.map((r) => r.series),
  });
}
