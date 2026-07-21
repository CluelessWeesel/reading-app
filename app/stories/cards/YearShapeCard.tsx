import { fraunces } from "../../shared/fonts";
import { formatDateShort } from "../../shared/formatDateShort";
import { DailyPagesGraph } from "../DailyPagesGraph";
import type { YearShapeCardData } from "../types";

export function YearShapeCard({ card }: { card: YearShapeCardData }) {
  return (
    <div className="flex h-full flex-col justify-center gap-6">
      <p className="text-center text-xs font-medium uppercase tracking-[0.25em] opacity-60">The year&apos;s shape</p>

      <DailyPagesGraph bars={card.bars} bestDate={card.bestDate} />

      {card.bestDate && (
        <p className="text-center text-sm">
          <span className={`${fraunces.className} font-semibold text-gold-ink`}>{card.bestPages.toLocaleString()} pages</span>
          <span className="opacity-70"> on {formatDateShort(card.bestDate)}, the year&apos;s biggest day</span>
        </p>
      )}

      <p className="text-center text-xs italic opacity-60">{card.wryLine}</p>
    </div>
  );
}
