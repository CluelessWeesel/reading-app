"use client";

import type { Book } from "../bookTypes";
import { fraunces } from "../fonts";
import { daysBetweenInclusive } from "../isoDate";
import { ProgressDots } from "./ProgressDots";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-card/50 py-4 text-center">
      <p className="text-2xl font-semibold text-ink">{value}</p>
      <p className="text-xs uppercase tracking-wide text-ink-faint">{label}</p>
    </div>
  );
}

export function ClosingScreen({
  book,
  ranking,
  yearTotals,
  yearRead,
  totalSteps,
  onDone,
}: {
  book: Book;
  ranking: { rank: number; year: number } | null;
  yearTotals: { books: number; pages: number };
  yearRead: number;
  totalSteps: number;
  onDone: () => void;
}) {
  const days =
    book.date_started && book.date_finished
      ? daysBetweenInclusive(book.date_started, book.date_finished)
      : null;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10 text-center">
      <div className="mb-6 w-full">
        <ProgressDots current={totalSteps - 1} total={totalSteps} />
      </div>
      <p className={`${fraunces.className} mb-2 text-sm uppercase tracking-wide text-ink-faint`}>Finished</p>
      <h2 className={`${fraunces.className} mb-8 text-3xl font-semibold text-ink`}>{book.title}</h2>

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

      <div className="mb-8 rounded-xl border border-hairline bg-card/50 px-6 py-4">
        <p className="text-sm text-ink-faint">
          {yearTotals.books} books · {yearTotals.pages.toLocaleString()} pages in {yearRead}
        </p>
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
