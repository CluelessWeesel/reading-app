import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// Dedicated, minimal endpoint for the one thing it does -- unlike the
// general PATCH /api/tbr/[id] (which requires resending the whole entry,
// title included), this only ever touches the three prediction columns.
// predicted_at is always stamped server-side to the moment the call is
// actually made, never trusted from the client -- that's what "you called
// this N days ago" measures from later, at the finish ceremony reveal.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { predicted_score, predicted_margin } = body as Record<string, unknown>;

  if (!isFiniteNumber(predicted_score) || predicted_score < 0.5 || predicted_score > 5 || Math.round(predicted_score * 2) !== predicted_score * 2) {
    return NextResponse.json({ error: "predicted_score must be between 0.5 and 5, in steps of 0.5." }, { status: 400 });
  }
  if (!isFiniteNumber(predicted_margin) || predicted_margin < 0 || predicted_margin > 4.5) {
    return NextResponse.json({ error: "predicted_margin must be between 0 and 4.5." }, { status: 400 });
  }

  const { rows } = await pool.query(
    `update tbr set predicted_score = $1, predicted_margin = $2, predicted_at = now()
     where id = $3
     returning id, predicted_score::float8 as predicted_score, predicted_margin::float8 as predicted_margin,
       to_char(predicted_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as predicted_at`,
    [predicted_score, predicted_margin, idNum]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}
