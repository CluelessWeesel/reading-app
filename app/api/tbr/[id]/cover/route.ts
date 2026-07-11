import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

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
  if (!body || typeof body !== "object" || !("cover_url" in body)) {
    return NextResponse.json({ error: "Expected { cover_url }" }, { status: 400 });
  }

  const raw = (body as { cover_url: unknown }).cover_url;
  const coverUrl = raw === null || raw === undefined ? null : String(raw).trim() || null;

  const { rowCount } = await pool.query(`update tbr set cover_url = $1 where id = $2`, [
    coverUrl,
    idNum,
  ]);

  if (rowCount === 0) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  return NextResponse.json({ id: idNum, cover_url: coverUrl });
}
