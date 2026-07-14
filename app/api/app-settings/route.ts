import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  const { rows } = await pool.query<{ key: string; value: string }>(`select key, value from app_settings`);
  return NextResponse.json({ settings: rows });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { key, value } = body as Record<string, unknown>;
  if (typeof key !== "string" || !key.trim()) {
    return NextResponse.json({ error: "key is required." }, { status: 400 });
  }
  if (typeof value !== "string") {
    return NextResponse.json({ error: "value must be a string." }, { status: 400 });
  }

  await pool.query(
    `insert into app_settings (key, value) values ($1, $2)
     on conflict (key) do update set value = excluded.value`,
    [key.trim(), value]
  );

  return NextResponse.json({ key: key.trim(), value });
}
