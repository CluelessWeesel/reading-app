import Link from "next/link";
import { pool } from "@/lib/db";
import { fraunces } from "../shared/fonts";
import { NewStoryForm } from "./NewStoryForm";
import type { StoryType } from "./types";

export const dynamic = "force-dynamic";

type StoryListRow = { id: number; story_type: StoryType; period: string; generated_at: string; card_count: number };

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

function periodLabel(row: StoryListRow): string {
  if (row.story_type === "wrapped") return row.period;
  const [y, m] = row.period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function StoriesPage() {
  const stories = await getStories();

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className={`${fraunces.className} text-3xl font-semibold text-ink-warm sm:text-4xl`}>Stories</h1>
          <p className="mt-1 text-sm text-ink-warm-faint">
            Monthly recaps, yearly Wrapped, and whatever ritual comes next -- generated once, frozen, and re-frozen
            only when you say so.
          </p>
        </header>

        <div className="mb-8 rounded-2xl border border-gold bg-surface-1 p-5">
          <h2 className={`${fraunces.className} mb-3 text-lg font-semibold text-ink-warm`}>Generate a new story</h2>
          <NewStoryForm />
        </div>

        {stories.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-warm-faint">No stories generated yet.</p>
        ) : (
          <ul className="divide-y divide-gold overflow-hidden rounded-xl border border-gold">
            {stories.map((s) => (
              <li key={s.id}>
                <Link href={`/stories/${s.id}`} className="flex items-center justify-between gap-4 bg-surface-1 px-4 py-3 hover:bg-hover">
                  <div className="min-w-0">
                    <p className={`${fraunces.className} truncate text-sm font-semibold text-ink-warm`}>
                      {periodLabel(s)}
                      <span className="ml-2 rounded-full border border-gold px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">
                        {s.story_type}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-warm-faint">
                      {s.card_count} card{s.card_count === 1 ? "" : "s"} · generated {s.generated_at.slice(0, 10)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
