"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchBookMetadata } from "./bookMetadata";
import type { Book } from "./bookTypes";
import { Cover } from "./Cover";
import { EditBookModal } from "./EditBookModal";
import { FinishBookCeremony } from "./finish-ceremony/FinishBookCeremony";
import { FORMAT_LABELS } from "./formatLabels";
import { fraunces } from "./fonts";
import { todayLocalIso } from "./isoDate";

type CurrentBook = Book & { position: number };

function progressPercent(book: CurrentBook): number {
  if (book.format_type === "audio") return Math.max(0, Math.min(100, book.position));
  if (book.page_count) return Math.max(0, Math.min(100, (book.position / book.page_count) * 100));
  return 0;
}

function formatProgressLabel(book: CurrentBook): string {
  if (book.format_type === "audio") return `${book.position}%`;
  if (book.page_count != null) return `${book.position} / ${book.page_count} pages`;
  return `page ${book.position}`;
}

export function CurrentlyReadingPanel() {
  const [books, setBooks] = useState<CurrentBook[] | null>(null);
  const [positionDrafts, setPositionDrafts] = useState<Record<number, string>>({});
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [seriesOptions, setSeriesOptions] = useState<string[]>([]);
  const [subgenreOptions, setSubgenreOptions] = useState<string[]>([]);
  const [metadataError, setMetadataError] = useState(false);
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [finishingBookId, setFinishingBookId] = useState<number | null>(null);

  function loadMetadata() {
    setMetadataError(false);
    fetchBookMetadata()
      .then((data) => {
        setAllGenres(data.genres);
        setSeriesOptions(data.series);
        setSubgenreOptions(data.subgenres);
      })
      .catch(() => setMetadataError(true));
  }

  function refresh() {
    fetch("/api/current-books")
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setBooks(data);
        setPositionDrafts((prev) => {
          const next: Record<number, string> = {};
          for (const b of data as CurrentBook[]) {
            next[b.book_id] = prev[b.book_id] ?? String(b.position);
          }
          return next;
        });
      })
      .catch(() => setBooks([]));
  }

  useEffect(() => {
    refresh();
    loadMetadata();
    window.addEventListener("current-books:changed", refresh);
    return () => window.removeEventListener("current-books:changed", refresh);
  }, []);

  function handleCoverChange(bookId: number, coverUrl: string | null) {
    setBooks((prev) => prev?.map((b) => (b.book_id === bookId ? { ...b, cover_url: coverUrl } : b)) ?? prev);
  }

  async function handleSavePosition(bookId: number) {
    const draft = positionDrafts[bookId];
    const value = Number(draft);
    if (Number.isNaN(value) || value < 0) return;
    const res = await fetch(`/api/current-books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: value, date: todayLocalIso() }),
    });
    if (res.ok) refresh();
  }

  async function handleFormatChange(bookId: number, formatType: string) {
    const res = await fetch(`/api/current-books/${bookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format_type: formatType }),
    });
    if (res.ok) refresh();
  }

  async function handleDnf(bookId: number, title: string) {
    if (!window.confirm(`Mark "${title}" as DNF? It'll stay in your history but stop being "currently reading".`)) return;
    const res = await fetch(`/api/current-books/${bookId}/dnf`, { method: "POST" });
    if (res.ok) refresh();
  }

  async function handleAbandon(bookId: number, title: string) {
    if (!window.confirm(`Abandon starting "${title}"? This permanently deletes it -- no history kept.`)) return;
    const res = await fetch(`/api/current-books/${bookId}`, { method: "DELETE" });
    if (res.ok) refresh();
  }

  function handleBookSaved(updated: Book) {
    setBooks((prev) =>
      prev?.map((b) => (b.book_id === updated.book_id ? { ...b, ...updated } : b)) ?? prev
    );
    setEditingBookId(null);
  }

  function handleBookDeleted(bookId: number) {
    setBooks((prev) => prev?.filter((b) => b.book_id !== bookId) ?? prev);
    setEditingBookId(null);
  }

  const editingBook = books?.find((b) => b.book_id === editingBookId) ?? null;
  const finishingBook = books?.find((b) => b.book_id === finishingBookId) ?? null;

  if (books === null || books.length === 0) return null;

  return (
    <div className="surface-flat mb-8 rounded-xl p-4">
      <h2 className={`${fraunces.className} border-b border-gold pb-3 text-center text-lg font-semibold tracking-wide text-ink-warm`}>
        Currently Reading
      </h2>

      <ul className="divide-y divide-gold-ink/25">
        {books.map((book) => (
          <li key={book.book_id} className="py-4 first:pt-1">
            <div className="flex items-center gap-4">
              <Cover
                id={book.book_id}
                title={book.title}
                coverUrl={book.cover_url}
                onCoverChange={handleCoverChange}
                apiPath={`/api/books/${book.book_id}/cover`}
                className="aspect-[2/3] w-16 shrink-0"
                initialClassName="text-sm"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-ink-warm">
                  <Link href={`/books/${book.book_id}`} className="hover:underline">
                    {book.title}
                  </Link>
                </p>
                <p className="truncate text-sm italic text-ink-warm-faint">{book.author ?? "Unknown author"}</p>

                <div className="mt-2.5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-warm-muted">
                      {Math.round(progressPercent(book))}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gold-ink/20">
                    <div
                      className="h-full rounded-full bg-gold-ink transition-[width] duration-300"
                      style={{ width: `${progressPercent(book)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-warm-faint">{formatProgressLabel(book)}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gold pt-3">
              <input
                type="number"
                step="any"
                min="0"
                value={positionDrafts[book.book_id] ?? ""}
                onChange={(e) =>
                  setPositionDrafts((prev) => ({ ...prev, [book.book_id]: e.target.value }))
                }
                className="w-16 rounded-lg border border-gold bg-surface-1 px-2 py-1 text-sm text-ink-warm"
              />
              <button
                type="button"
                onClick={() => handleSavePosition(book.book_id)}
                className="text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
              >
                Save
              </button>

              <select
                value={book.format_type ?? ""}
                onChange={(e) => handleFormatChange(book.book_id, e.target.value)}
                className="rounded-lg border border-gold bg-surface-1 px-2 py-1 text-xs text-ink-warm"
              >
                {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setFinishingBookId(book.book_id)}
                className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-on-accent shadow-sm transition hover:brightness-95"
              >
                Finish
              </button>
              <button
                type="button"
                onClick={() => setEditingBookId(book.book_id)}
                className="text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDnf(book.book_id, book.title)}
                className="text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
              >
                DNF
              </button>
              <button
                type="button"
                onClick={() => handleAbandon(book.book_id, book.title)}
                className="text-xs text-red-600 underline decoration-dotted underline-offset-4 hover:text-red-700 dark:text-red-400"
              >
                Abandon
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editingBook && (
        <EditBookModal
          book={editingBook}
          allGenres={allGenres}
          seriesOptions={seriesOptions}
          subgenreOptions={subgenreOptions}
          metadataError={metadataError}
          onRetryMetadata={loadMetadata}
          onClose={() => setEditingBookId(null)}
          onSaved={handleBookSaved}
          onDeleted={handleBookDeleted}
        />
      )}

      {finishingBook && (
        <FinishBookCeremony
          book={finishingBook}
          onClose={() => setFinishingBookId(null)}
          onFinished={refresh}
        />
      )}
    </div>
  );
}
