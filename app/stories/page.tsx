import { pool } from "@/lib/db";
import { getGatewayGraphRows, getGatewayGraphTbrRows } from "./gatewayGraph/data";
import { GatewayGraphView } from "./gatewayGraph/GatewayGraphView";
import { StoriesSection, type StoryListRow } from "./StoriesSection";
import { StoriesTabs } from "./StoriesTabs";

export const dynamic = "force-dynamic";

async function getStories(): Promise<StoryListRow[]> {
  const { rows } = await pool.query<StoryListRow>(
    `select id, story_type, period,
            to_char(generated_at, 'YYYY-MM-DD"T"HH24:MI:SS') as generated_at,
            jsonb_array_length(payload -> 'cards') as card_count
     from generated_stories
     order by period desc, story_type asc`
  );
  return rows;
}

export default async function StoriesPage() {
  const [stories, gatewayRows, gatewayTbrRows] = await Promise.all([
    getStories(),
    getGatewayGraphRows(),
    getGatewayGraphTbrRows(),
  ]);

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <StoriesTabs
          stories={<StoriesSection stories={stories} />}
          graph={<GatewayGraphView rows={gatewayRows} tbrRows={gatewayTbrRows} />}
        />
      </div>
    </div>
  );
}
