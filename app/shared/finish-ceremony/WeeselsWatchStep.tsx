"use client";

import { useEffect, useState } from "react";
import type { Book } from "../bookTypes";
import { CeremonyStepShell } from "./CeremonyStepShell";

type Category = { id: number; name: string; rereads_eligible: boolean };

// Most Anticipated Author isn't tied to a book you just read at all -- it's
// about future releases -- so it's never offered here.
const NOT_BOOK_TIED = new Set(["Most Anticipated Author"]);

export function WeeselsWatchStep({
  book,
  stepIndex,
  totalSteps,
  onFinish,
  onBack,
}: {
  book: Book;
  stepIndex: number;
  totalSteps: number;
  onFinish: () => void;
  onBack: () => void;
}) {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/weesel-categories")
      .then((res) => res.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  const offered = (categories ?? []).filter(
    (c) => !NOT_BOOK_TIED.has(c.name) && (!book.reread || c.rereads_eligible)
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      if (selected.size > 0) {
        const res = await fetch(`/api/books/${book.book_id}/weesel-watch`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category_ids: Array.from(selected) }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Save failed.");
        }
      }
      onFinish();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (categories === null) {
    return (
      <CeremonyStepShell
        title="Weesels watch?"
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        onNext={onFinish}
        onSkip={onFinish}
        onBack={onBack}
      >
        <p className="text-sm text-ink-faint">Loading...</p>
      </CeremonyStepShell>
    );
  }

  return (
    <CeremonyStepShell
      title="Weesels watch?"
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      onNext={handleFinish}
      onSkip={handleFinish}
      onBack={onBack}
      nextLabel={saving ? "Finishing..." : "Finish"}
      nextDisabled={saving}
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-faint">
          Flag this one as a shortlist pick for this year&apos;s Weesels — just a note to yourself, not a commitment.
        </p>
        <div className="flex flex-wrap gap-2">
          {offered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              aria-pressed={selected.has(c.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                selected.has(c.id)
                  ? "border-accent bg-accent/10 text-ink"
                  : "border-hairline text-ink-muted hover:bg-hover"
              }`}
            >
              {selected.has(c.id) ? "⭐ " : ""}
              {c.name}
            </button>
          ))}
          {offered.length === 0 && <p className="text-sm text-ink-faint">No categories available.</p>}
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </CeremonyStepShell>
  );
}
