import { fraunces } from "../../shared/fonts";
import { formatDateShort } from "../../shared/formatDateShort";
import { DailyPagesGraph } from "../DailyPagesGraph";
import type { MonthShapeCardData } from "../types";

export function MonthShapeCard({ card }: { card: MonthShapeCardData }) {
  return (
    <div className="flex h-full flex-col justify-center gap-6">
      <p className="text-center text-xs font-medium uppercase tracking-[0.25em] opacity-60">The month&apos;s shape</p>

      <DailyPagesGraph bars={card.bars} bestDate={card.bestDate} />

      {card.bestDate && (
        <p className="text-center text-sm">
          <span className={`${fraunces.className} font-semibold`}>{card.bestPages.toLocaleString()} pages</span>
          <span className="opacity-60"> on {formatDateShort(card.bestDate)}, the month&apos;s biggest day</span>
        </p>
      )}

      {card.quietCaption && <p className="text-center text-xs italic opacity-60">{card.quietCaption}</p>}
    </div>
  );
}
