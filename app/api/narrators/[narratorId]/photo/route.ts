import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ narratorId: string }> }
) {
  const { narratorId } = await params;
  const narratorIdNum = Number(narratorId);
  if (!Number.isInteger(narratorIdNum)) {
    return NextResponse.json({ error: "Invalid narrator id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("cover_url" in body)) {
    return NextResponse.json({ error: "Expected { cover_url }" }, { status: 400 });
  }

  const raw = (body as { cover_url: unknown }).cover_url;
  const photoUrl = raw === null || raw === undefined ? null : String(raw).trim() || null;

  const { rowCount } = await pool.query(
    `update narrators set photo_url = $1 where id = $2`,
    [photoUrl, narratorIdNum]
  );

  if (rowCount === 0) {
    return NextResponse.json({ error: "Narrator not found" }, { status: 404 });
  }

  return NextResponse.json({ narrator_id: narratorIdNum, cover_url: photoUrl });
}
