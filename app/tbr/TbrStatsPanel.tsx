"use client";

import { fraunces } from "../shared/fonts";
import { computePredictionAccuracy } from "./tbrPredictionMath";
import type { ResolvedPrediction } from "./tbrPredictionMath";

// The one place predictions are allowed to surface unprompted: aggregate
// accuracy (never a specific book's call) plus the opt-in toggle that
// reveals individual values on TBR rows. Off by default -- sealing only
// works if looking is a deliberate choice.
export function TbrStatsPanel({
  unpredictedCount,
  resolvedPredictions,
  showPredictions,
  onToggleShowPredictions,
  onMakeCalls,
}: {
  unpredictedCount: number;
  resolvedPredictions: ResolvedPrediction[];
  showPredictions: boolean;
  onToggleShowPredictions: () => void;
  onMakeCalls: () => void;
}) {
  const accuracy = computePredictionAccuracy(resolvedPredictions);

  return (
    <div className="mb-6 rounded-xl border border-gold bg-surface-1 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`${fraunces.className} text-sm font-semibold text-ink-warm`}>Predictions</h2>
          <p className="text-xs text-ink-warm-faint">
            {unpredictedCount > 0
              ? `${unpredictedCount} book${unpredictedCount === 1 ? "" : "s"} still uncalled.`
              : "Every book on the TBR has a call in."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unpredictedCount > 0 && (
            <button
              type="button"
              onClick={onMakeCalls}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-on-accent shadow-sm transition hover:brightness-95"
            >
              Make some calls
            </button>
          )}
          <button
            type="button"
            onClick={onToggleShowPredictions}
            aria-pressed={showPredictions}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              showPredictions ? "bg-accent text-on-accent" : "border border-gold text-ink-warm-muted hover:bg-hover"
            }`}
          >
            {showPredictions ? "Hide predictions" : "Show predictions"}
          </button>
        </div>
      </div>

      {accuracy && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gold pt-3 sm:grid-cols-3">
          <div>
            <p className={`${fraunces.className} text-xl font-semibold text-ink-warm`}>±{accuracy.avgAbsError.toFixed(2)}</p>
            <p className="text-[10px] uppercase tracking-wide text-ink-warm-faint">avg. error</p>
          </div>
          <div>
            <p className={`${fraunces.className} text-xl font-semibold text-ink-warm`}>{Math.round(accuracy.hitRate * 100)}%</p>
            <p className="text-[10px] uppercase tracking-wide text-ink-warm-faint">hit within margin</p>
          </div>
          <div>
            <p className={`${fraunces.className} text-xl font-semibold text-ink-warm`}>{accuracy.n}</p>
            <p className="text-[10px] uppercase tracking-wide text-ink-warm-faint">calls resolved</p>
          </div>
        </div>
      )}
    </div>
  );
}
