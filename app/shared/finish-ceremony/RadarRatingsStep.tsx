"use client";

import { useEffect, useState } from "react";
import type { Book } from "../bookTypes";
import { StarRating } from "../../library/StarRating";
import { CeremonyStepShell } from "./CeremonyStepShell";
import { RadarChart } from "./RadarChart";

type Slot = { category: string; score: number | null };

function isValidScore(n: number): boolean {
  return !Number.isNaN(n) && n >= 0.5 && n <= 5 && Math.round(n * 2) === n * 2;
}

export function RadarRatingsStep({
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
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [swapOpenFor, setSwapOpenFor] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/books/${book.book_id}/rating-categories`)
      .then((res) => res.json())
      .then((data) => {
        const dealt: string[] = Array.isArray(data.dealt) ? data.dealt : [];
        setSlots(dealt.map((c) => ({ category: c, score: null })));
        setAllCategories(Array.isArray(data.all) ? data.all : []);
      })
      .catch(() => setSlots([]));
  }, [book.book_id]);

  function setSlotScore(index: number, value: string) {
    setSlots((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], score: value.trim() ? Number(value) : null };
      return next;
    });
  }

  function swapSlot(index: number, newCategory: string) {
    setSlots((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { category: newCategory, score: null };
      return next;
    });
    setSwapOpenFor(null);
  }

  async function handleNext() {
    const slotList = slots ?? [];
    for (const s of slotList) {
      if (s.score != null && !isValidScore(s.score)) {
        setError(`${s.category}: score must be between 0.5 and 5, in steps of 0.5.`);
        return;
      }
    }
    const rated = slotList.filter((s) => s.score != null) as { category: string; score: number }[];
    if (rated.length === 0) {
      onSkip();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${book.book_id}/ratings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings: rated }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed.");
      }
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (slots === null) {
    return (
      <CeremonyStepShell title="Radar ratings" stepIndex={stepIndex} totalSteps={totalSteps} onNext={onSkip} onSkip={onSkip} onBack={onBack}>
        <p className="text-sm text-ink-warm-faint">Loading...</p>
      </CeremonyStepShell>
    );
  }

  return (
    <CeremonyStepShell
      title="Radar ratings"
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      onNext={handleNext}
      onSkip={onSkip}
      onBack={onBack}
      nextLabel={saving ? "Saving..." : "Next"}
      nextDisabled={saving}
    >
      <div className="space-y-6">
        <RadarChart categories={slots} />

        <div className="space-y-3">
          {slots.map((slot, i) => (
            <div key={i} className="rounded-lg border border-gold bg-surface-1 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-ink-warm">{slot.category}</span>
                <button
                  type="button"
                  onClick={() => setSwapOpenFor(swapOpenFor === i ? null : i)}
                  className="text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
                >
                  Swap
                </button>
              </div>
              {swapOpenFor === i && (
                <select
                  className="mb-2 w-full rounded-lg border border-gold bg-surface-1 px-2 py-1 text-sm text-ink-warm"
                  value=""
                  onChange={(e) => e.target.value && swapSlot(i, e.target.value)}
                >
                  <option value="">Choose a category...</option>
                  {allCategories
                    .filter((c) => !slots.some((s) => s.category === c))
                    .map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                </select>
              )}
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0.5"
                  max="5"
                  value={slot.score ?? ""}
                  onChange={(e) => setSlotScore(i, e.target.value)}
                  placeholder="Skip"
                  className="w-20 rounded-lg border border-gold bg-surface-1 px-2 py-1.5 text-center text-ink-warm outline-none focus:ring-2 focus:ring-accent/40"
                />
                {slot.score != null && <StarRating score={slot.score} />}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </CeremonyStepShell>
  );
}
