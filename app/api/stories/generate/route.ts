import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { computeStoryPayload } from "@/app/stories/generateStory";

const STORY_TYPES = new Set(["recap", "wrapped"]);

// Generates (or re-generates, if this story_type/period already exists) a
// story and freezes it into generated_stories.payload. Later reads always
// come back off that frozen row -- see the [id]/regenerate route for the
// explicit, confirmed re-freeze action once a story already exists.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { story_type, period } = body as Record<string, unknown>;

  if (typeof story_type !== "string" || !STORY_TYPES.has(story_type)) {
    return NextResponse.json({ error: "story_type must be 'recap' or 'wrapped'." }, { status: 400 });
  }
  if (typeof period !== "string" || !/^\d{4}(-\d{2})?$/.test(period)) {
    return NextResponse.json({ error: "period must be 'YYYY' (wrapped) or 'YYYY-MM' (recap)." }, { status: 400 });
  }
  if (story_type === "recap" && !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: "A recap period must be 'YYYY-MM'." }, { status: 400 });
  }
  if (story_type === "wrapped" && !/^\d{4}$/.test(period)) {
    return NextResponse.json({ error: "A wrapped period must be 'YYYY'." }, { status: 400 });
  }

  try {
    const { rows: existing } = await pool.query(`select id from generated_stories where story_type = $1 and period = $2`, [
      story_type,
      period,
    ]);
    // Generate is a one-time action -- an existing story for this
    // story_type/period is only ever re-frozen via the explicit, confirmed
    // regenerate route, never silently overwritten by calling this again.
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `A ${story_type} for ${period} already exists.`, id: existing[0].id },
        { status: 409 }
      );
    }

    const payload = await computeStoryPayload(story_type as "recap" | "wrapped", period);

    const { rows } = await pool.query(
      `insert into generated_stories (story_type, period, payload)
       values ($1, $2, $3)
       returning id, story_type, period, payload, to_char(generated_at, 'YYYY-MM-DD"T"HH24:MI:SS') as generated_at, user_note`,
      [story_type, period, JSON.stringify(payload)]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to generate story." }, { status: 500 });
  }
}
