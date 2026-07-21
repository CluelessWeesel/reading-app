import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Flips tier_fill_completed once the opening ceremony has placed every
// eligible book -- from this point on, /api/tier-board/place starts
// writing to tier_moves for every placement (including the automatic
// Holding drop on a fresh finish). Idempotent: calling it again is harmless.
export async function POST() {
  await pool.query(
    `insert into app_settings (key, value) values ('tier_fill_completed', 'true')
     on conflict (key) do update set value = 'true'`
  );
  return NextResponse.json({ ok: true });
}
