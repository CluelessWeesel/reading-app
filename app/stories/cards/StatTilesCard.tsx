import { fraunces } from "../../shared/fonts";
import type { StatTilesCardData } from "../types";

function fmtWords(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000).toLocaleString()}k` : String(Math.round(n));
}

export function StatTilesCard({ card }: { card: StatTilesCardData }) {
  const barMax = Math.max(card.pages, card.averagePages ?? 0, 1);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-center">
      <div>
        <p className={`${fraunces.className} text-5xl font-semibold sm:text-6xl`}>{Math.round(card.pages).toLocaleString()}</p>
        <p className="mt-1 text-xs uppercase tracking-wide opacity-60">Pages</p>
        {card.pagesVsAveragePercent != null && (
          <p className="mt-1 text-xs font-medium opacity-70">
            {card.pagesVsAveragePercent >= 0 ? "+" : ""}
            {Math.round(card.pagesVsAveragePercent)}% vs your monthly average
          </p>
        )}

        {card.averagePages != null && (
          <div className="mx-auto mt-4 w-full max-w-[220px] space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-left text-[10px] opacity-60">This month</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-current/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(card.pages / barMax) * 100}%`, backgroundColor: "var(--accent-blue)" }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-left text-[10px] opacity-60">Average</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-current/10">
                <div
                  className="h-full rounded-full opacity-40"
                  style={{ width: `${(card.averagePages / barMax) * 100}%`, backgroundColor: "var(--accent-blue)" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-10">
        <div>
          <p className={`${fraunces.className} text-3xl font-semibold`}>{card.books}</p>
          <p className="mt-1 text-xs uppercase tracking-wide opacity-60">Books</p>
        </div>
        <div>
          <p className={`${fraunces.className} text-3xl font-semibold`}>{fmtWords(card.words)}</p>
          <p className="mt-1 text-xs uppercase tracking-wide opacity-60">Words</p>
        </div>
      </div>
    </div>
  );
}
