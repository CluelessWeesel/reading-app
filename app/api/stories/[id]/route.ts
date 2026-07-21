import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Only user_note is editable directly -- payload/generated_at only ever
// change via the regenerate route, never a plain field edit here.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "Invalid story id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("user_note" in body)) {
    return NextResponse.json({ error: "Expected { user_note }" }, { status: 400 });
  }
  const raw = (body as { user_note: unknown }).user_note;
  const userNote = raw === null || raw === undefined ? null : String(raw).trim() || null;

  const { rowCount } = await pool.query(`update generated_stories set user_note = $1 where id = $2`, [userNote, idNum]);
  if (rowCount === 0) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  return NextResponse.json({ id: idNum, user_note: userNote });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "Invalid story id" }, { status: 400 });
  }

  const { rowCount } = await pool.query(`delete from generated_stories where id = $1`, [idNum]);
  if (rowCount === 0) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
