"use client";

import { useEffect, useState } from "react";
import type { Book } from "../bookTypes";
import { CeremonyStepShell } from "./CeremonyStepShell";

type Prompt = { id: number; question: string };

export function CardPromptsStep({
  book,
  stepIndex,
  totalSteps,
  onNext,
  onBack,
}: {
  book: Book;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
}) {
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [rerolling, setRerolling] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/prompts/deal?bookId=${book.book_id}`)
      .then((res) => res.json())
      .then((data) => setPrompts(Array.isArray(data) ? data : []))
      .catch(() => setPrompts([]));
  }, [book.book_id]);

  async function handleReroll(index: number) {
    if (!prompts) return;
    setRerolling((prev) => ({ ...prev, [index]: true }));
    try {
      const res = await fetch("/api/prompts/reroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.book_id, excludeIds: prompts.map((p) => p.id) }),
      });
      if (!res.ok) return;
      const newPrompt: Prompt = await res.json();
      setPrompts((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        next[index] = newPrompt;
        return next;
      });
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[prompts[index].id];
        return next;
      });
    } finally {
      setRerolling((prev) => ({ ...prev, [index]: false }));
    }
  }

  async function handleFinish() {
    const answerList = Object.entries(answers)
      .filter(([, value]) => value.trim())
      .map(([promptId, value]) => ({ prompt_id: Number(promptId), answer: value.trim() }));

    setSaving(true);
    setError(null);
    try {
      if (answerList.length > 0) {
        const res = await fetch(`/api/books/${book.book_id}/prompt-answers`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: answerList }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Save failed.");
        }
      }
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (prompts === null) {
    return (
      <CeremonyStepShell title="A few questions" stepIndex={stepIndex} totalSteps={totalSteps} onNext={onNext} onSkip={onNext} onBack={onBack}>
        <p className="text-sm text-ink-warm-faint">Loading...</p>
      </CeremonyStepShell>
    );
  }

  return (
    <CeremonyStepShell
      title="A few questions"
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      onNext={handleFinish}
      onSkip={handleFinish}
      onBack={onBack}
      nextLabel={saving ? "Saving..." : "Next"}
      nextDisabled={saving}
    >
      <div className="space-y-4">
        {prompts.length === 0 && (
          <p className="text-sm text-ink-warm-faint">No prompts available right now.</p>
        )}
        {prompts.map((prompt, i) => (
          <div key={prompt.id} className="rounded-lg border border-gold bg-surface-1 p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-ink-warm">{prompt.question}</p>
              <button
                type="button"
                onClick={() => handleReroll(i)}
                disabled={rerolling[i]}
                className="shrink-0 text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm disabled:opacity-50"
              >
                {rerolling[i] ? "..." : "Reroll"}
              </button>
            </div>
            <textarea
              value={answers[prompt.id] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [prompt.id]: e.target.value }))}
              placeholder="Optional"
              className="w-full rounded-lg border border-gold bg-surface-1 p-2 text-sm text-ink-warm outline-none focus:ring-2 focus:ring-accent/40"
              rows={2}
            />
          </div>
        ))}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </CeremonyStepShell>
  );
}
