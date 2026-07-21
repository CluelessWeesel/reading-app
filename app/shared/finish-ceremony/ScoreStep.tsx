"use client";

import { useState } from "react";
import type { Book } from "../bookTypes";
import { StarRating } from "../../library/StarRating";
import { CeremonyStepShell } from "./CeremonyStepShell";

export function ScoreStep({
  book,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
  onBack,
}: {
  book: Book;
  stepIndex: number;
  totalSteps: number;
  onNext: (updated: Book) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [score, setScore] = useState(book.score != null ? String(book.score) : "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleNext() {
    const trimmed = score.trim();
    if (!trimmed) {
      onSkip();
      return;
    }
    const n = Number(trimmed);
    if (Number.isNaN(n) || n < 0.5 || n > 5 || Math.round(n * 2) !== n * 2) {
      setError("Score must be between 0.5 and 5, in steps of 0.5.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${book.book_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...book, score: n }),
      });
      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responseBody.error || "Save failed.");
      onNext({ ...book, ...responseBody });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const previewScore = score.trim() ? Number(score) : null;

  return (
    <CeremonyStepShell
      title="Score"
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      onNext={handleNext}
      onSkip={onSkip}
      onBack={onBack}
      nextLabel={saving ? "Saving..." : "Next"}
      nextDisabled={saving}
    >
      <div className="flex flex-col items-center gap-6 py-8">
        {previewScore != null && !Number.isNaN(previewScore) && (
          <div className="text-2xl">
            <StarRating score={previewScore} />
          </div>
        )}
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0.5"
          max="5"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder="0.5 - 5"
          className="w-32 rounded-lg border border-gold bg-surface-1 px-4 py-3 text-center text-3xl text-ink-warm outline-none focus:ring-2 focus:ring-accent/40"
          autoFocus
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </CeremonyStepShell>
  );
}
