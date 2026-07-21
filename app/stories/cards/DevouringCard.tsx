import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import { StarRating } from "../../library/StarRating";
import type { DevouringCardData } from "../types";

export function DevouringCard({ card }: { card: DevouringCardData }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.25em] opacity-60">The devouring</p>
      <CoverThumb title={card.title} coverUrl={card.coverUrl} className="aspect-[2/3] w-28 shadow-lg" />
      <p className={`${fraunces.className} text-xl font-semibold`}>{card.title}</p>
      <StarRating score={card.score} />
      <p className={`${fraunces.className} mt-2 text-3xl font-semibold text-gold-ink`}>{card.pagesPerDay.toFixed(1)} pg/day</p>
      {card.vsYearAveragePace != null && (
        <p className="text-xs opacity-60">{card.vsYearAveragePace.toFixed(1)}x your average pace this year</p>
      )}
      {card.days != null && (
        <p className="text-sm opacity-60">
          Finished in {card.days} day{card.days === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
