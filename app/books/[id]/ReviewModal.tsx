"use client";

import { useState } from "react";
import { fraunces } from "@/app/shared/fonts";
import { fieldClass, modalLabelClass } from "@/app/shared/formControls";
import type { Book } from "@/app/shared/bookTypes";

// A focused review-only editor -- PATCH /api/books/[bookId] replaces the
// whole row (no partial-update support), so every other field has to be
// resent unchanged alongside the new review text, exactly as EditBookModal
// already does for its own save.
export function ReviewModal({
  book,
  onClose,
  onSaved,
}: {
  book: Book;
  onClose: () => void;
  onSaved: (book: Book) => void;
}) {
  const [review, setReview] = useState(book.review ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${book.book_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: book.title,
          author: book.author,
          series: book.series,
          series_number: book.series_number,
          genre: book.genre,
          subgenre: book.subgenre,
          year_released: book.year_released,
          year_read: book.year_read,
          score: book.score,
          predicted_score: book.predicted_score,
          predicted_margin: book.predicted_margin,
          format_raw: book.format_raw,
          format_type: book.format_type,
          word_count: book.word_count,
          page_count: book.page_count,
          narrator: book.narrator,
          reread: book.reread,
          date_started: book.date_started,
          date_finished: book.date_finished,
          isbn: book.isbn,
          status: book.status,
          review: review.trim() || null,
        }),
      });
      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responseBody.error || "Save failed.");
      onSaved({ ...book, ...responseBody });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gold bg-surface-3 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="review-modal-title" className={`${fraunces.className} text-xl font-semibold text-ink-warm`}>
            {book.review ? "Edit review" : "Add review"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full px-2 py-1 text-ink-warm-faint hover:bg-hover hover:text-ink-warm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={modalLabelClass()} htmlFor="review-text">
              {book.title}
            </label>
            <textarea
              id="review-text"
              className={`${fieldClass()} min-h-40`}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              autoFocus
              placeholder="What did you think?"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-gold px-4 py-1.5 text-sm text-ink-warm-muted hover:text-ink-warm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
