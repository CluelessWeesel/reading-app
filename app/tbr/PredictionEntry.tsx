"use client";

import { useState } from "react";

const SCORE_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
// Covers the common case (a half-star-or-less hedge); the DB itself allows
// up to 4.5 if a wider call is ever needed via a direct edit.
const MARGIN_STEPS = [0, 0.5, 1, 1.5, 2];

// Pure picker UI, no fetch/persistence of its own -- reused as-is by both
// the single-row prediction modal and the "make some calls" sequential
// flow, which each wire onSave/onSkip to their own call site.
export function PredictionEntry({
  initialScore = null,
  initialMargin = null,
  onSave,
  onSkip,
  saving = false,
  error = null,
  saveLabel = "Save",
}: {
  initialScore?: number | null;
  initialMargin?: number | null;
  onSave: (score: number, margin: number) => void;
  onSkip: () => void;
  saving?: boolean;
  error?: string | null;
  saveLabel?: string;
}) {
  const [score, setScore] = useState<number | null>(initialScore);
  const [margin, setMargin] = useState<number | null>(initialMargin);

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-warm-faint">Predicted score</p>
      <div className="mb-4 grid grid-cols-5 gap-1.5">
        {SCORE_STEPS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScore(s)}
            aria-pressed={score === s}
            className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
              score === s ? "border-accent bg-accent text-on-accent" : "border-gold text-ink-warm-muted hover:bg-hover"
            }`}
          >
            {s.toFixed(1)}
          </button>
        ))}
      </div>

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-warm-faint">Margin (give or take)</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {MARGIN_STEPS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMargin(m)}
            aria-pressed={margin === m}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              margin === m ? "border-accent bg-accent text-on-accent" : "border-gold text-ink-warm-muted hover:bg-hover"
            }`}
          >
            ±{m.toFixed(1)}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
        >
          Skip
        </button>
        <button
          type="button"
          disabled={score == null || margin == null || saving}
          onClick={() => score != null && margin != null && onSave(score, margin)}
          className="ml-auto rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-on-accent shadow-sm transition disabled:opacity-50"
        >
          {saving ? "Saving..." : saveLabel}
        </button>
      </div>
    </div>
  );
}
