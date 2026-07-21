import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { computeStoryPayload } from "@/app/stories/generateStory";

// The one sanctioned way an already-frozen story's payload changes --
// re-runs the exact same computation against current data and overwrites
// payload + generated_at in place. user_note is untouched: it's a separate,
// freeform annotation, not part of the computed stats. Requires an
// explicit confirmed:true from the caller (the UI should confirm with the
// user first) -- this isn't a casual action, it's "I fixed something
// upstream and want history to reflect it."
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "Invalid story id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== "object" || (body as Record<string, unknown>).confirmed !== true) {
    return NextResponse.json({ error: "Regenerating requires confirmed: true." }, { status: 400 });
  }

  try {
    const { rows: existing } = await pool.query<{ story_type: "recap" | "wrapped"; period: string }>(
      `select story_type, period from generated_stories where id = $1`,
      [idNum]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const payload = await computeStoryPayload(existing[0].story_type, existing[0].period);

    const { rows } = await pool.query(
      `update generated_stories set payload = $1, generated_at = now()
       where id = $2
       returning id, story_type, period, payload, to_char(generated_at, 'YYYY-MM-DD"T"HH24:MI:SS') as generated_at, user_note`,
      [JSON.stringify(payload), idNum]
    );

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to regenerate story." }, { status: 500 });
  }
}
