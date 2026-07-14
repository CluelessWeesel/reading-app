import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function GET() {
  const { rows } = await pool.query<{ year: number; pages_goal: number }>(
    `select year, pages_goal from reading_goals order by year asc`
  );
  return NextResponse.json({ goals: rows });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { year, pages_goal } = body as Record<string, unknown>;

  if (!isFiniteNumber(year) || !Number.isInteger(year)) {
    return NextResponse.json({ error: "year must be a whole number." }, { status: 400 });
  }
  if (!isFiniteNumber(pages_goal) || pages_goal <= 0) {
    return NextResponse.json({ error: "pages_goal must be a positive number." }, { status: 400 });
  }

  await pool.query(
    `insert into reading_goals (year, pages_goal) values ($1, $2)
     on conflict (year) do update set pages_goal = excluded.pages_goal`,
    [year, Math.round(pages_goal)]
  );

  return NextResponse.json({ year, pages_goal: Math.round(pages_goal) });
}
