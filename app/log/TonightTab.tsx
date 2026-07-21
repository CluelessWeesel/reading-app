"use client";

import { useState } from "react";
import { Cover } from "../shared/Cover";
import { FORMAT_LABELS } from "../shared/formatLabels";
import { addIsoDays, todayLocalIso } from "../shared/isoDate";
import {
  computePagesDelta,
  formatPositionLabel,
  positionInputMode,
  positionQuestionLabel,
} from "../shared/positionMath";
import { BackfillForm } from "./BackfillForm";
import type { CurrentBookForLog } from "./types";

export function TonightTab({
  currentBooks,
  onBooksUpdated,
  onCoverChange,
}: {
  currentBooks: CurrentBookForLog[];
  onBooksUpdated: (updates: { book_id: number; position: number; last_log_date: string }[]) => void;
  onCoverChange: (bookId: number, coverUrl: string | null) => void;
}) {
  const today = todayLocalIso();
  const [selectedDate, setSelectedDate] = useState(today);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [todayTotal, setTodayTotal] = useState<number | null>(null);

  function handleChange(book: CurrentBookForLog, value: string) {
    setInputs((prev) => ({ ...prev, [book.book_id]: value }));

    const trimmed = value.trim();
    if (!trimmed) {
      setErrors((prev) => ({ ...prev, [book.book_id]: null }));
      return;
    }
    const num = Number(trimmed);
    if (Number.isNaN(num)) {
      setErrors((prev) => ({ ...prev, [book.book_id]: "Enter a number." }));
      return;
    }
    if (num < book.position) {
      setErrors((prev) => ({
        ...prev,
        [book.book_id]: `Can't go backwards (currently ${formatPositionLabel(book.position, book.format_type, book.page_count)}).`,
      }));
      return;
    }
    setErrors((prev) => ({ ...prev, [book.book_id]: null }));
  }

  function deltaDisplay(book: CurrentBookForLog): string | null {
    const raw = inputs[book.book_id];
    if (!raw?.trim()) return null;
    const num = Number(raw);
    if (Number.isNaN(num) || num < book.position) return null;
    const delta = computePagesDelta(num, book.position, book.format_type, book.page_count);
    if (delta === null) return null;
    return `+${delta} page${delta === 1 ? "" : "s"}`;
  }

  const loggableEntries = currentBooks
    .filter((b) => inputs[b.book_id]?.trim() && !errors[b.book_id])
    .map((b) => ({ book_id: b.book_id, position: Number(inputs[b.book_id]) }));

  async function handleSave() {
    if (loggableEntries.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: loggableEntries, date: today }),
      });
      const data = await res.json();

      const updates: { book_id: number; position: number; last_log_date: string }[] = [];
      for (const r of data.results as { book_id: number; ok: boolean; error?: string }[]) {
        if (r.ok) {
          const entry = loggableEntries.find((e) => e.book_id === r.book_id);
          if (entry) updates.push({ book_id: r.book_id, position: entry.position, last_log_date: today });
          setInputs((prev) => ({ ...prev, [r.book_id]: "" }));
        } else {
          setErrors((prev) => ({ ...prev, [r.book_id]: r.error ?? "Failed to save." }));
        }
      }
      if (updates.length > 0) onBooksUpdated(updates);
      if (typeof data.today_total === "number") setTodayTotal(data.today_total);
    } finally {
      setSaving(false);
    }
  }

  function stepDate(deltaDays: number) {
    setSelectedDate((prev) => {
      const next = addIsoDays(prev, deltaDays);
      return next > today ? today : next;
    });
  }

  if (currentBooks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-ink-warm-faint">
        Nothing currently reading. Start a book from Library or TBR first.
      </p>
    );
  }

  const dateNav = (
    <div className="mb-4 flex items-center justify-center gap-3">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => stepDate(-1)}
        className="shrink-0 rounded-lg border border-gold bg-surface-1 px-3 py-2 text-ink-warm-faint transition hover:text-ink-warm"
      >
        ‹
      </button>
      <p className="text-sm font-medium text-ink-warm">{selectedDate === today ? "Tonight" : selectedDate}</p>
      <button
        type="button"
        aria-label="Next day"
        onClick={() => stepDate(1)}
        disabled={selectedDate >= today}
        className="shrink-0 rounded-lg border border-gold bg-surface-1 px-3 py-2 text-ink-warm-faint transition hover:text-ink-warm disabled:opacity-30"
      >
        ›
      </button>
    </div>
  );

  if (selectedDate !== today) {
    return (
      <div>
        {dateNav}
        <BackfillForm
          key={selectedDate}
          targetDate={selectedDate}
          currentBooks={currentBooks}
          onBooksUpdated={onBooksUpdated}
          onCoverChange={onCoverChange}
        />
      </div>
    );
  }

  return (
    <div>
      {dateNav}
      <div className="space-y-4">
        {currentBooks.map((book) => {
          const needsPageCount = book.format_type === "audio" && book.page_count == null;
          return (
            <div key={book.book_id} className="rounded-xl border border-gold bg-surface-1 p-4">
              <div className="mb-3 flex items-center gap-3">
                <Cover
                  id={book.book_id}
                  title={book.title}
                  coverUrl={book.cover_url}
                  onCoverChange={onCoverChange}
                  apiPath={`/api/books/${book.book_id}/cover`}
                  className="aspect-[2/3] w-10"
                  initialClassName="text-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-warm">{book.title}</p>
                  <p className="truncate text-xs text-ink-warm-faint">
                    {FORMAT_LABELS[book.format_type ?? ""] ?? "Unknown format"} · Last:{" "}
                    {formatPositionLabel(book.position, book.format_type, book.page_count)}
                  </p>
                </div>
              </div>

              {needsPageCount ? (
                <p className="rounded-lg bg-hover px-3 py-2 text-sm text-ink-warm-faint">
                  Set a page count for this book in Library to log it here.
                </p>
              ) : (
                <>
                  <label className="mb-1 block text-sm font-medium text-ink-warm" htmlFor={`pos-${book.book_id}`}>
                    {positionQuestionLabel(book.format_type)}
                  </label>
                  <input
                    id={`pos-${book.book_id}`}
                    type="number"
                    inputMode={positionInputMode(book.format_type)}
                    value={inputs[book.book_id] ?? ""}
                    onChange={(e) => handleChange(book, e.target.value)}
                    className="w-full rounded-lg border border-gold bg-surface-1 px-4 py-3 text-center text-2xl text-ink-warm outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  {errors[book.book_id] && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors[book.book_id]}</p>
                  )}
                  {deltaDisplay(book) && (
                    <p className="mt-1 text-sm font-medium text-accent">{deltaDisplay(book)}</p>
                  )}
                </>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loggableEntries.length === 0}
          className="w-full rounded-full bg-accent py-4 text-lg font-semibold text-on-accent shadow-sm transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>

        {todayTotal !== null && (
          <p className="text-center text-sm text-ink-warm-faint">Today&apos;s total: {todayTotal} pages</p>
        )}
      </div>
    </div>
  );
}
