import { notFound } from "next/navigation";
import { pool } from "@/lib/db";
import { WrappedViewer } from "./WrappedViewer";
import type { GeneratedStory } from "../../stories/types";

export const dynamic = "force-dynamic";

async function getWrapped(period: string): Promise<GeneratedStory | null> {
  const { rows } = await pool.query<GeneratedStory>(
    `select id, story_type, period, payload,
            to_char(generated_at, 'YYYY-MM-DD"T"HH24:MI:SS') as generated_at,
            user_note
     from generated_stories
     where story_type = 'wrapped' and period = $1`,
    [period]
  );
  return rows[0] ?? null;
}

export default async function WrappedDetailPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) notFound();

  const wrapped = await getWrapped(year);
  if (!wrapped) notFound();

  return <WrappedViewer story={wrapped} />;
}
