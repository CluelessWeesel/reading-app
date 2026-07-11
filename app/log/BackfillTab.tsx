"use client";

import { useState } from "react";
import { Cover } from "../shared/Cover";
import { FORMAT_LABELS } from "../shared/formatLabels";
import { addIsoDays, daysBetweenInclusive } from "../shared/isoDate";
import {
  computePagesDelta,
  formatPositionLabel,
  positionInputMode,
  positionQuestionLabel,
} from "../shared/positionMath";
import type { CurrentBookForLog } from "./types";

function rangeStartFor(book: CurrentBookForLog): string | null {
  if (book.last_log_date) return addIsoDays(book.last_log_date, 1);
  return book.date_started;
}

export function BackfillTab({
  currentBooks,
  onBooksUpdated,
  onCoverChange,
}: {
  currentBooks: CurrentBookForLog[];
  onBooksUpdated: (updates: { book_id: number; position: number; last_log_date: string }[]) => void;
  onCoverChange: (bookId: number, coverUrl: string | null) => void;
}) {
  const yesterday = addIsoDays(new Date().toISOString().slice(0, 10), -1);
  const [targetDate, setTargetDate] = useState("");
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [spreadChoice, setSpreadChoice] = useState<Record<number, "even" | "single">>({});
  const [errors, setErrors] = useState<Record<number, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function handleChange(book: CurrentBookForLog, value: string) {
    setInputs((prev) => ({ ...prev, [book.book_id]: value }));
    setSavedMessage(null);

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
    return `+${delta} page${delta === 1 ? "" : "s"} total`;
  }

  const loggableEntries = targetDate
    ? currentBooks
        .filter((b) => inputs[b.book_id]?.trim() && !errors[b.book_id])
        .map((b) => ({
          book_id: b.book_id,
          position: Number(inputs[b.book_id]),
          spread: spreadChoice[b.book_id] ?? "even",
        }))
    : [];

  async function handleSave() {
    if (!targetDate || loggableEntries.length === 0) return;
    setSaving(true);
    setSavedMessage(null);
    try {
      const res = await fetch("/api/log/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: targetDate, entries: loggableEntries }),
      });
      const data = await res.json();

      const updates: { book_id: number; position: number; last_log_date: string }[] = [];
      let successCount = 0;
      for (const r of data.results as { book_id: number; ok: boolean; error?: string }[]) {
        if (r.ok) {
          const entry = loggableEntries.find((e) => e.book_id === r.book_id);
          if (entry) updates.push({ book_id: r.book_id, position: entry.position, last_log_date: targetDate });
          setInputs((prev) => ({ ...prev, [r.book_id]: "" }));
          successCount++;
        } else {
          setErrors((prev) => ({ ...prev, [r.book_id]: r.error ?? "Failed to save." }));
        }
      }
      if (updates.length > 0) onBooksUpdated(updates);
      if (successCount > 0) setSavedMessage(`Backfilled ${successCount} book${successCount === 1 ? "" : "s"} for ${targetDate}.`);
    } finally {
      setSaving(false);
    }
  }

  if (currentBooks.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-ink-faint">
        Nothing currently reading. Start a book from Library or TBR first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="backfill-date">
          Date to fill in
        </label>
        <input
          id="backfill-date"
          type="date"
          max={yesterday}
          value={targetDate}
          onChange={(e) => {
            setTargetDate(e.target.value);
            setSavedMessage(null);
          }}
          className="w-full rounded-lg border border-hairline bg-card px-4 py-3 text-lg text-ink outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      {targetDate &&
        currentBooks.map((book) => {
          const needsPageCount = book.format_type === "audio" && book.page_count == null;
          const rangeStart = rangeStartFor(book);
          const beforeRange = rangeStart != null && targetDate < rangeStart;
          const gapDays = rangeStart && !beforeRange ? daysBetweenInclusive(rangeStart, targetDate) : 0;

          return (
            <div key={book.book_id} className="rounded-xl border border-hairline bg-card/50 p-4">
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
                  <p className="truncate font-semibold text-ink">{book.title}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {FORMAT_LABELS[book.format_type ?? ""] ?? "Unknown format"} · Last:{" "}
                    {formatPositionLabel(book.position, book.format_type, book.page_count)}
                    {book.last_log_date ? ` (${book.last_log_date})` : " (never logged)"}
                  </p>
                </div>
              </div>

              {beforeRange ? (
                <p className="rounded-lg bg-hover px-3 py-2 text-sm text-ink-faint">
                  Pick a date on or after {rangeStart} for this book.
                </p>
              ) : needsPageCount ? (
                <p className="rounded-lg bg-hover px-3 py-2 text-sm text-ink-faint">
                  Set a page count for this book in Library to log it here.
                </p>
              ) : (
                <>
                  {gapDays > 1 && (
                    <div className="mb-2 rounded-lg bg-hover px-3 py-2 text-sm text-ink-faint">
                      <p className="mb-1">{gapDays} unlogged days between {rangeStart} and {targetDate}.</p>
                      <div className="flex gap-1 rounded-full border border-hairline bg-card p-1">
                        <button
                          type="button"
                          onClick={() => setSpreadChoice((prev) => ({ ...prev, [book.book_id]: "even" }))}
                          className={`flex-1 rounded-full px-2 py-1 text-xs transition ${
                            (spreadChoice[book.book_id] ?? "even") === "even"
                              ? "bg-accent text-on-accent"
                              : "text-ink-muted hover:text-ink"
                          }`}
                        >
                          Spread evenly
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpreadChoice((prev) => ({ ...prev, [book.book_id]: "single" }))}
                          className={`flex-1 rounded-full px-2 py-1 text-xs transition ${
                            spreadChoice[book.book_id] === "single"
                              ? "bg-accent text-on-accent"
                              : "text-ink-muted hover:text-ink"
                          }`}
                        >
                          All on {targetDate}
                        </button>
                      </div>
                    </div>
                  )}

                  <label className="mb-1 block text-sm font-medium text-ink" htmlFor={`backfill-pos-${book.book_id}`}>
                    {positionQuestionLabel(book.format_type)} (as of {targetDate})
                  </label>
                  <input
                    id={`backfill-pos-${book.book_id}`}
                    type="number"
                    inputMode={positionInputMode(book.format_type)}
                    value={inputs[book.book_id] ?? ""}
                    onChange={(e) => handleChange(book, e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-card px-4 py-3 text-center text-2xl text-ink outline-none focus:ring-2 focus:ring-accent/40"
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

      {targetDate && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loggableEntries.length === 0}
          className="w-full rounded-full bg-accent py-4 text-lg font-semibold text-on-accent shadow-sm transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      )}

      {savedMessage && <p className="text-center text-sm text-ink-faint">{savedMessage}</p>}
    </div>
  );
}
