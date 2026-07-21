import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import type { PerfectScoresCardData } from "../types";

export function PerfectScoresCard({ card }: { card: PerfectScoresCardData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.25em] opacity-60">The perfect scores</p>

      {card.entries.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {card.entries.map((e) => (
            <div key={e.bookId} className="flex flex-col items-center gap-1.5">
              <CoverThumb
                title={e.title}
                coverUrl={e.coverUrl}
                className="aspect-[2/3] w-20 shadow-lg ring-2 ring-gold-ink/60"
              />
              <p className={`${fraunces.className} w-20 truncate text-xs font-medium`}>{e.title}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className={`${fraunces.className} max-w-xs text-lg italic text-ink-warm-muted`}>{card.droughtLine}</p>
      )}
    </div>
  );
}
