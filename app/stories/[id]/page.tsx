import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { StoryViewer } from "./StoryViewer";
import type { GeneratedStory } from "../types";

export const dynamic = "force-dynamic";

async function getStory(id: number): Promise<GeneratedStory | null> {
  const { rows } = await pool.query<GeneratedStory>(
    `select id, story_type, period, payload,
            to_char(generated_at, 'YYYY-MM-DD"T"HH24:MI:SS') as generated_at,
            user_note
     from generated_stories where id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export default async function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) notFound();

  const story = await getStory(idNum);
  if (!story) notFound();

  return <StoryViewer story={story} />;
}
