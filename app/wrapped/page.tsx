import Link from "next/link";
import { pool } from "@/lib/db";
import { fraunces } from "../shared/fonts";
import type { ColdOpenCardData, StoryCardData } from "../stories/types";

export const dynamic = "force-dynamic";

type WrappedListRow = { period: string; payload: { cards: StoryCardData[]; final?: boolean } };

async function getWrappedYears(): Promise<WrappedListRow[]> {
  const { rows } = await pool.query<WrappedListRow>(
    `select period, payload from generated_stories where story_type = 'wrapped' order by period desc`
  );
  return rows;
}

function extractColdOpen(cards: StoryCardData[]): ColdOpenCardData | null {
  return (cards.find((c) => c.type === "cold-open") as ColdOpenCardData | undefined) ?? null;
}

export default async function WrappedArchivePage() {
  const years = await getWrappedYears();

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <h1 className={`${fraunces.className} text-3xl font-semibold text-ink-warm sm:text-4xl`}>Wrapped</h1>
          <p className="mt-1 text-sm text-ink-warm-faint">Every year, crowned.</p>
        </header>

        {years.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-warm-faint">No Wrapped generated yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {years.map((y) => {
              const coldOpen = extractColdOpen(y.payload.cards);
              const isFinal = y.payload.final !== false;
              return (
                <Link key={y.period} href={`/wrapped/${y.period}`} className="surface-card rounded-xl p-4">
                  <p className={`${fraunces.className} flex items-center gap-2 text-lg font-semibold text-ink-warm`}>
                    {y.period}
                    {!isFinal && (
                      <span className="rounded-full border border-gold px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gold-ink">
                        Projected
                      </span>
                    )}
                  </p>
                  {coldOpen && (
                    <p className="mt-1 text-xs text-ink-warm-faint">
                      {coldOpen.books} book{coldOpen.books === 1 ? "" : "s"} · {coldOpen.pages.toLocaleString()} pages
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
