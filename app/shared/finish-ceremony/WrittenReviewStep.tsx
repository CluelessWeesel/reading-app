"use client";

import { useState } from "react";
import type { Book } from "../bookTypes";
import { CeremonyStepShell } from "./CeremonyStepShell";

export function WrittenReviewStep({
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
  const [review, setReview] = useState(book.review ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleNext() {
    if (!review.trim()) {
      onSkip();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${book.book_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...book, review: review.trim() }),
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

  return (
    <CeremonyStepShell
      title="Written review"
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      onNext={handleNext}
      onSkip={onSkip}
      onBack={onBack}
      nextLabel={saving ? "Saving..." : "Next"}
      nextDisabled={saving}
    >
      <div className="flex h-full flex-col gap-3">
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="What did you think?"
          className="min-h-[220px] flex-1 rounded-lg border border-hairline bg-card p-4 text-ink outline-none focus:ring-2 focus:ring-accent/40"
          autoFocus
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </CeremonyStepShell>
  );
}
