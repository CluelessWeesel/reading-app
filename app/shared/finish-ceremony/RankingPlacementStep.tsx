"use client";

import { useEffect, useState } from "react";
import type { Book } from "../bookTypes";
import { CeremonyStepShell } from "./CeremonyStepShell";

type RankingRow = { rank: number; title: string; book_id: number | null; score: number | null; had_star: boolean };

export function RankingPlacementStep({
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
  onNext: (rank: number, year: number) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const year = book.date_finished ? Number(book.date_finished.slice(0, 4)) : new Date().getFullYear();
  const [rankings, setRankings] = useState<RankingRow[] | null>(null);
  // insertAfter = -1 means "place at #1 (top)"; otherwise insert after rankings[insertAfter]
  const [insertAfter, setInsertAfter] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/book-rankings?year=${year}`)
      .then((res) => res.json())
      .then((data) => {
        // Exclude this book's own existing slot (e.g. if the user came Back to
        // this step after already placing it) -- it shouldn't be a placement
        // target for itself.
        const list: RankingRow[] = (data.rankings ?? []).filter(
          (r: RankingRow) => r.book_id !== book.book_id
        );
        setRankings(list);
        setInsertAfter(list.length - 1);
      })
      .catch(() => setRankings([]));
  }, [year, book.book_id]);

  async function handleNext() {
    const rankNum = insertAfter + 2;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/book-rankings/insert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          rank: rankNum,
          book_id: book.book_id,
          title: book.title,
          score: book.score,
          had_star: false,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Save failed.");
      }
      onNext(rankNum, year);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // If the user placed a ranking, went Back, and now skips instead, remove the
  // stale slot so this book doesn't stay ranked from an earlier pass. Best-effort:
  // a failure here shouldn't block the user from moving on.
  async function handleSkip() {
    try {
      await fetch("/api/book-rankings/insert", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, book_id: book.book_id }),
      });
    } catch {
      // best-effort
    }
    onSkip();
  }

  if (rankings === null) {
    return (
      <CeremonyStepShell title="Ranking placement" stepIndex={stepIndex} totalSteps={totalSteps} onNext={handleSkip} onSkip={handleSkip} onBack={onBack}>
        <p className="text-sm text-ink-warm-faint">Loading...</p>
      </CeremonyStepShell>
    );
  }

  const newBookRank = insertAfter + 2;

  function displayRank(idx: number) {
    return idx + 1 + (idx > insertAfter ? 1 : 0);
  }

  const NewBookRow = (
    <div className="flex items-center gap-2 border-b border-gold bg-accent/10 px-3 py-2 text-sm last:border-0">
      <span className="w-6 text-right font-semibold text-ink-warm">{newBookRank}</span>
      <span className="font-medium text-ink-warm">{book.title} (new)</span>
    </div>
  );

  return (
    <CeremonyStepShell
      title="Ranking placement"
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      onNext={handleNext}
      onSkip={handleSkip}
      onBack={onBack}
      nextLabel={saving ? "Saving..." : "Insert"}
      nextDisabled={saving}
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-warm-faint">Tap where it lands among your {year} reads.</p>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="max-h-96 overflow-y-auto rounded-lg border border-gold">
          {rankings.length === 0 ? (
            <p className="p-3 text-sm text-ink-warm-faint">First book ranked for {year} -- it&apos;ll be #1.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setInsertAfter(-1)}
                className={`block w-full border-b border-gold px-3 py-2 text-left text-xs last:border-0 ${
                  insertAfter === -1 ? "bg-accent/10 font-medium text-ink-warm" : "text-ink-warm-faint hover:bg-hover"
                }`}
              >
                Place at #1 (top of {year})
              </button>
              {insertAfter === -1 && NewBookRow}
              {rankings.map((r, idx) => (
                <div key={r.book_id ?? idx}>
                  <button
                    type="button"
                    onClick={() => setInsertAfter(idx)}
                    className={`flex w-full items-center gap-2 border-b border-gold px-3 py-2 text-left text-sm last:border-0 ${
                      insertAfter === idx ? "bg-hover" : "hover:bg-hover"
                    }`}
                  >
                    <span className="w-6 text-right text-ink-warm-faint">{displayRank(idx)}</span>
                    <span className="min-w-0 flex-1 truncate text-ink-warm">{r.title}</span>
                    <span className="shrink-0 text-xs text-ink-warm-faint">insert after</span>
                  </button>
                  {insertAfter === idx && NewBookRow}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </CeremonyStepShell>
  );
}
