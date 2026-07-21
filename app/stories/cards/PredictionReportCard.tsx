import { fraunces } from "../../shared/fonts";
import type { PredictionReportCardData } from "../types";

export function PredictionReportCard({ card }: { card: PredictionReportCardData }) {
  return (
    <div className="flex h-full flex-col justify-center gap-6">
      <p className="text-center text-xs font-medium uppercase tracking-[0.25em] opacity-60">The prediction report</p>

      <div className="text-center">
        <p className={`${fraunces.className} text-3xl font-semibold text-gold-ink`}>±{card.seasonAccuracy.toFixed(2)}</p>
        <p className="mt-1 text-xs opacity-60">
          average error across {card.seasonCount} prediction{card.seasonCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className="space-y-3 border-t border-current/15 pt-4 text-sm">
        <p>
          <span className="opacity-60">Best call: </span>
          <span className="font-medium">{card.bestCall.title}</span>
          <span className="opacity-60">
            {" "}
            — predicted {card.bestCall.predicted.toFixed(1)}, scored {card.bestCall.actual.toFixed(1)}
          </span>
        </p>
        <p>
          <span className="opacity-60">Biggest miss: </span>
          <span className="font-medium">{card.biggestMiss.title}</span>
          <span className="opacity-60">
            {" "}
            — predicted {card.biggestMiss.predicted.toFixed(1)}, scored {card.biggestMiss.actual.toFixed(1)}
          </span>
        </p>
      </div>
    </div>
  );
}
