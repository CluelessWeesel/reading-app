import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import { StarRating } from "../../library/StarRating";
import { rankColor } from "../../books/[id]/rankColor";
import type { FinishedThisMonthCardData } from "../types";

export function FinishedThisMonthCard({ card }: { card: FinishedThisMonthCardData }) {
  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <p className="text-center text-xs font-medium uppercase tracking-[0.25em] opacity-60">Finished this month</p>

      <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
        {card.books.map((b) => {
          const badge = b.rank != null && b.total != null ? rankColor(b.rank, b.total) : null;
          return (
            <div key={b.bookId} className="flex flex-col items-center gap-1 text-center">
              <div className="relative">
                <CoverThumb title={b.title} coverUrl={b.coverUrl} className="aspect-[2/3] w-14 sm:w-16" />
                {badge && (
                  <span
                    className="absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium shadow-sm"
                    style={{ background: badge.background, color: badge.color }}
                  >
                    #{b.rank}
                  </span>
                )}
              </div>
              <p className={`${fraunces.className} w-full truncate text-[11px] font-medium`}>{b.title}</p>
              <StarRating score={b.score} />
            </div>
          );
        })}
      </div>

      {card.milestones.length > 0 && (
        <div className="space-y-1 border-t border-current/15 pt-3">
          {card.milestones.map((m, i) => (
            <p key={i} className="text-center text-xs opacity-70">
              🎯 {m.label} on {m.date}
            </p>
          ))}
        </div>
      )}

      {card.weeselsWatch.length > 0 && (
        <div className="space-y-1 border-t border-current/15 pt-3">
          {card.weeselsWatch.map((w, i) => (
            <p key={i} className="text-center text-xs opacity-70">
              🏆 &ldquo;{w.title}&rdquo; is in the running for {w.category}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
