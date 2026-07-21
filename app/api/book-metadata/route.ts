import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Genre options (constrained by the genres table FK), series autocomplete
// suggestions, and subgenre autocomplete suggestions -- for edit forms that
// live outside /library (e.g. the Currently Reading panel) and so don't
// already have this from a server component fetch. Subgenre is free text
// (no dedicated table like genre has), so its suggestion list is every
// distinct value already in use across both books and the TBR.
export async function GET() {
  const [genres, series, subgenres] = await Promise.all([
    pool.query<{ genre: string }>(`select genre from genres order by genre asc`),
    pool.query<{ series: string }>(
      `select distinct series from books where series is not null order by series asc`
    ),
    pool.query<{ subgenre: string }>(
      `select distinct subgenre from (
         select subgenre from books where subgenre is not null
         union
         select subgenre from tbr where subgenre is not null
       ) s order by subgenre asc`
    ),
  ]);
  return NextResponse.json({
    genres: genres.rows.map((r) => r.genre),
    series: series.rows.map((r) => r.series),
    subgenres: subgenres.rows.map((r) => r.subgenre),
  });
}
