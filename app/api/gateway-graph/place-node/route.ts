import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Person/source roots have no date of their own (unlike books), so unlike
// place-book this always upserts BOTH x and y together -- there's no
// "locked axis" here, the whole point is a free 2D drag.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { node_key, x, y } = body as Record<string, unknown>;

  if (typeof node_key !== "string" || !(node_key.startsWith("person:") || node_key.startsWith("source:"))) {
    return NextResponse.json({ error: "node_key must be a person:... or source:... key." }, { status: 400 });
  }
  if (typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" || !Number.isFinite(y)) {
    return NextResponse.json({ error: "x and y must both be finite numbers." }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      `insert into gateway_node_placement (node_key, x, y) values ($1, $2, $3)
       on conflict (node_key) do update set x = excluded.x, y = excluded.y
       returning node_key, x::float8 as x, y::float8 as y`,
      [node_key, x, y]
    );
    return NextResponse.json(rows[0]);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "23514") {
      return NextResponse.json({ error: "That node key doesn't look like a person or source." }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to save placement." }, { status: 500 });
  }
}
