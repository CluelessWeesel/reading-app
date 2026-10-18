import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Single endpoint for everything that can happen to a book's placement:
// first drop from the tray, a later X reposition, and editing its outgoing
// edge's curve style -- all live on the same book_graph_placement row (see
// 0034_gateway_tree_placement.sql), so there's only one place this drifts.
//
// x present -> upsert (insert on first placement, update x on conflict;
// placed_at is deliberately never touched on conflict -- presence of the
// row IS the "placed" flag, first-placed time shouldn't move on a drag).
// x absent, edge_curved present -> edge-only update; the book must already
// be placed (there's no sensible x to insert a brand-new row with).
// edge_control2_dx/dy present makes it a double curve (0035 migration).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { book_id, x, edge_curved, edge_control_dx, edge_control_dy, edge_control2_dx, edge_control2_dy } = body as Record<string, unknown>;

  if (!Number.isInteger(book_id)) {
    return NextResponse.json({ error: "book_id is required." }, { status: 400 });
  }
  const bookId = book_id as number;

  if (x != null && (typeof x !== "number" || !Number.isFinite(x))) {
    return NextResponse.json({ error: "x must be a finite number, or omitted." }, { status: 400 });
  }
  if (edge_curved != null && typeof edge_curved !== "boolean") {
    return NextResponse.json({ error: "edge_curved must be a boolean, or omitted." }, { status: 400 });
  }
  if (edge_control_dx != null && (typeof edge_control_dx !== "number" || !Number.isFinite(edge_control_dx))) {
    return NextResponse.json({ error: "edge_control_dx must be a finite number, or omitted." }, { status: 400 });
  }
  if (edge_control_dy != null && (typeof edge_control_dy !== "number" || !Number.isFinite(edge_control_dy))) {
    return NextResponse.json({ error: "edge_control_dy must be a finite number, or omitted." }, { status: 400 });
  }
  if (edge_control2_dx != null && (typeof edge_control2_dx !== "number" || !Number.isFinite(edge_control2_dx))) {
    return NextResponse.json({ error: "edge_control2_dx must be a finite number, or omitted." }, { status: 400 });
  }
  if (edge_control2_dy != null && (typeof edge_control2_dy !== "number" || !Number.isFinite(edge_control2_dy))) {
    return NextResponse.json({ error: "edge_control2_dy must be a finite number, or omitted." }, { status: 400 });
  }

  try {
    if (typeof x === "number") {
      const { rows } = await pool.query(
        `insert into book_graph_placement (book_id, x, edge_curved, edge_control_dx, edge_control_dy, edge_control2_dx, edge_control2_dy)
         values ($1, $2, coalesce($3, false), $4, $5, $6, $7)
         on conflict (book_id) do update set
           x = excluded.x,
           edge_curved = coalesce($3, book_graph_placement.edge_curved),
           edge_control_dx = case when $3 is not null then $4 else book_graph_placement.edge_control_dx end,
           edge_control_dy = case when $3 is not null then $5 else book_graph_placement.edge_control_dy end,
           edge_control2_dx = case when $3 is not null then $6 else book_graph_placement.edge_control2_dx end,
           edge_control2_dy = case when $3 is not null then $7 else book_graph_placement.edge_control2_dy end
         returning book_id, x::float8 as x, edge_curved,
           edge_control_dx::float8 as edge_control_dx, edge_control_dy::float8 as edge_control_dy,
           edge_control2_dx::float8 as edge_control2_dx, edge_control2_dy::float8 as edge_control2_dy`,
        [
          bookId,
          x,
          typeof edge_curved === "boolean" ? edge_curved : null,
          edge_control_dx ?? null,
          edge_control_dy ?? null,
          edge_control2_dx ?? null,
          edge_control2_dy ?? null,
        ]
      );
      return NextResponse.json(rows[0]);
    }

    if (edge_curved == null) {
      return NextResponse.json({ error: "Provide x, edge_curved, or both." }, { status: 400 });
    }
    const { rows, rowCount } = await pool.query(
      `update book_graph_placement set edge_curved = $1, edge_control_dx = $2, edge_control_dy = $3,
         edge_control2_dx = $4, edge_control2_dy = $5
       where book_id = $6
       returning book_id, x::float8 as x, edge_curved,
         edge_control_dx::float8 as edge_control_dx, edge_control_dy::float8 as edge_control_dy,
         edge_control2_dx::float8 as edge_control2_dx, edge_control2_dy::float8 as edge_control2_dy`,
      [edge_curved, edge_control_dx ?? null, edge_control_dy ?? null, edge_control2_dx ?? null, edge_control2_dy ?? null, bookId]
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: "This book hasn't been placed on the canvas yet." }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "23514") {
      return NextResponse.json(
        { error: "Invalid line shape: a curved line needs its handle(s), a straight one can't have any, and a double curve needs both." },
        { status: 400 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to save placement." }, { status: 500 });
  }
}
