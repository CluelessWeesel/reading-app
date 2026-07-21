import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { RecapViewer } from "./RecapViewer";
import type { GeneratedStory } from "../../stories/types";

export const dynamic = "force-dynamic";

async function getRecap(period: string): Promise<GeneratedStory | null> {
  const { rows } = await pool.query<GeneratedStory>(
    `select id, story_type, period, payload,
            to_char(generated_at, 'YYYY-MM-DD"T"HH24:MI:SS') as generated_at,
            user_note
     from generated_stories
     where story_type = 'recap' and period = $1`,
    [period]
  );
  return rows[0] ?? null;
}

export default async function RecapDetailPage({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  if (!/^\d{4}-\d{2}$/.test(period)) notFound();

  const recap = await getRecap(period);
  if (!recap) notFound();

  return <RecapViewer story={recap} />;
}
