import Link from "next/link";
import { pool } from "@/lib/db";
import { fraunces } from "../shared/fonts";
import type { StatTilesCardData, StoryCardData } from "../stories/types";

export const dynamic = "force-dynamic";

type RecapListRow = { period: string; payload: { cards: StoryCardData[] } };

async function getRecaps(): Promise<RecapListRow[]> {
  const { rows } = await pool.query<RecapListRow>(
    `select period, payload from generated_stories where story_type = 'recap' order by period desc`
  );
  return rows;
}

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

function extractStatTiles(cards: StoryCardData[]): StatTilesCardData | null {
  return (cards.find((c) => c.type === "stat-tiles") as StatTilesCardData | undefined) ?? null;
}

export default async function RecapsArchivePage() {
  const recaps = await getRecaps();

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <h1 className={`${fraunces.className} text-3xl font-semibold text-ink-warm sm:text-4xl`}>Recaps</h1>
          <p className="mt-1 text-sm text-ink-warm-faint">Every month, frozen the moment it ended.</p>
        </header>

        {recaps.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-warm-faint">No recaps generated yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {recaps.map((r) => {
              const stats = extractStatTiles(r.payload.cards);
              return (
                <Link key={r.period} href={`/recaps/${r.period}`} className="surface-card rounded-xl p-4">
                  <p className={`${fraunces.className} text-lg font-semibold text-ink-warm`}>{monthLabel(r.period)}</p>
                  {stats && (
                    <p className="mt-1 text-xs text-ink-warm-faint">
                      {stats.books} book{stats.books === 1 ? "" : "s"} · {Math.round(stats.pages).toLocaleString()} pages
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
