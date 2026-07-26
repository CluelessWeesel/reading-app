"use client";

import type { Book } from "../bookTypes";
import { fraunces } from "../fonts";
import { daysBetweenInclusive } from "../isoDate";
import { ProgressDots } from "./ProgressDots";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gold bg-surface-1 py-4 text-center">
      <p className="text-2xl font-semibold text-ink-warm">{value}</p>
      <p className="text-xs uppercase tracking-wide text-ink-warm-faint">{label}</p>
    </div>
  );
}

export function ClosingScreen({
  book,
  ranking,
  yearTotals,
  yearRead,
  addedToHolding,
  totalSteps,
  onDone,
}: {
  book: Book;
  ranking: { rank: number; year: number } | null;
  yearTotals: { books: number; pages: number };
  yearRead: number;
  addedToHolding: boolean;
  totalSteps: number;
  onDone: () => void;
}) {
  const days =
    book.date_started && book.date_finished
      ? daysBetweenInclusive(book.date_started, book.date_finished)
      : null;

  // The one and only reveal moment -- everywhere else (TBR rows, the start-
  // a-book flow) this stays sealed. Only renders once there's both a call
  // and a real result to compare it against.
  const hasPrediction = book.predicted_score != null && book.score != null;
  const hit =
    hasPrediction && book.predicted_margin != null
      ? Math.abs((book.score as number) - (book.predicted_score as number)) <= book.predicted_margin
      : null;
  const daysSinceCall =
    hasPrediction && book.predicted_at && book.date_finished
      ? daysBetweenInclusive(book.predicted_at.slice(0, 10), book.date_finished)
      : null;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10 text-center">
      <div className="mb-6 w-full">
        <ProgressDots current={totalSteps - 1} total={totalSteps} />
      </div>
      <p className={`${fraunces.className} mb-2 text-sm uppercase tracking-wide text-ink-warm-faint`}>Finished</p>
      <h2 className={`${fraunces.className} mb-8 text-3xl font-semibold text-ink-warm`}>{book.title}</h2>

      <div className="mb-8 grid w-full grid-cols-2 gap-4">
        {ranking ? (
          <Stat label={`${ranking.year} ranking`} value={`#${ranking.rank}`} />
        ) : (
          <Stat label="Ranking" value="Unranked" />
        )}
        <Stat label="Days taken" value={days != null ? String(days) : "Unknown"} />
        <Stat label="Pages" value={book.page_count != null ? book.page_count.toLocaleString() : "--"} />
        <Stat
          label="Words"
          value={book.word_count != null ? Math.round(book.word_count).toLocaleString() : "--"}
        />
      </div>

      {hasPrediction && (
        <div className="mb-8 w-full rounded-xl border border-gold bg-surface-1 px-6 py-4">
          <p className="text-xs uppercase tracking-wide text-ink-warm-faint">Your call</p>
          <p className={`${fraunces.className} mt-1 text-lg text-ink-warm`}>
            Predicted {(book.predicted_score as number).toFixed(1)}
            {book.predicted_margin != null ? ` ±${book.predicted_margin.toFixed(1)}` : ""} · Actual{" "}
            {(book.score as number).toFixed(1)}
          </p>
          {hit != null && (
            <p className={`mt-1 text-sm font-medium ${hit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {hit ? "Hit" : "Miss"}
            </p>
          )}
          {daysSinceCall != null && (
            <p className="mt-1 text-xs text-ink-warm-faint">
              You called this {daysSinceCall} day{daysSinceCall === 1 ? "" : "s"} ago.
            </p>
          )}
        </div>
      )}

      <div className="mb-8 rounded-xl border border-gold bg-surface-1 px-6 py-4">
        <p className="text-sm text-ink-warm-faint">
          {yearTotals.books} books · {yearTotals.pages.toLocaleString()} pages in {yearRead}
        </p>
        {addedToHolding && (
          <p className="mt-2 text-xs text-ink-warm-faint">Added to your tier board&apos;s holding row.</p>
        )}
      </div>

      <button
        type="button"
        onClick={onDone}
        className="rounded-full bg-accent px-8 py-3 text-base font-semibold text-on-accent shadow-sm transition"
      >
        Done
      </button>
    </div>
  );
}
