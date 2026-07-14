"use client";

import { useEffect, useState } from "react";
import { fraunces } from "./fonts";
import { fieldClass, modalLabelClass } from "./formControls";
import { FORMAT_LABELS } from "./formatLabels";
import type { Book } from "./bookTypes";

type FormState = {
  title: string;
  author: string;
  series: string;
  series_number: string;
  genre: string;
  subgenre: string;
  year_released: string;
  year_read: string;
  score: string;
  predicted_score: string;
  predicted_margin: string;
  format_raw: string;
  format_type: string;
  word_count: string;
  page_count: string;
  narrator: string;
  reread: boolean;
  date_started: string;
  date_finished: string;
  isbn: string;
  status: string;
};

function toFormState(book: Book): FormState {
  return {
    title: book.title,
    author: book.author ?? "",
    series: book.series ?? "",
    series_number: book.series_number != null ? String(book.series_number) : "",
    genre: book.genre ?? "",
    subgenre: book.subgenre ?? "",
    year_released: book.year_released != null ? String(book.year_released) : "",
    year_read: book.year_read != null ? String(book.year_read) : "",
    score: book.score != null ? String(book.score) : "",
    predicted_score: book.predicted_score != null ? String(book.predicted_score) : "",
    predicted_margin: book.predicted_margin != null ? String(book.predicted_margin) : "",
    format_raw: book.format_raw ?? "",
    format_type: book.format_type ?? "",
    word_count: book.word_count != null ? String(book.word_count) : "",
    page_count: book.page_count != null ? String(book.page_count) : "",
    narrator: book.narrator ?? "",
    reread: book.reread,
    date_started: book.date_started ?? "",
    date_finished: book.date_finished ?? "",
    isbn: book.isbn ?? "",
    status: book.status ?? "",
  };
}

// Only title is always required. author/genre/format_raw/format_type/
// page_count/year_read are nullable at the DB level specifically so a
// currently-reading book (started with only what's known) can be edited
// without being forced to backfill fields that won't be known until it's
// finished -- so each of these is validated only if provided.
function validate(form: FormState): string | null {
  if (!form.title.trim()) return "Title is required.";

  if (form.year_read.trim() && !Number.isInteger(Number(form.year_read))) {
    return "Year read must be a whole number.";
  }
  if (form.page_count.trim()) {
    const pageCount = Number(form.page_count);
    if (!Number.isInteger(pageCount) || pageCount <= 0) {
      return "Page count must be a positive whole number.";
    }
  }
  if (form.series_number.trim() && Number.isNaN(Number(form.series_number))) {
    return "Series number must be a number.";
  }
  if (form.year_released.trim() && !Number.isInteger(Number(form.year_released))) {
    return "Year released must be a whole number.";
  }
  if (form.word_count.trim() && Number.isNaN(Number(form.word_count))) {
    return "Word count must be a number.";
  }

  if (form.score.trim()) {
    const s = Number(form.score);
    if (Number.isNaN(s) || s < 0.5 || s > 5 || Math.round(s * 2) !== s * 2) {
      return "Score must be between 0.5 and 5, in steps of 0.5.";
    }
  }

  if (form.date_started && form.date_finished && form.date_started > form.date_finished) {
    return "Date finished can't be before date started.";
  }

  if (form.predicted_score.trim()) {
    const p = Number(form.predicted_score);
    if (Number.isNaN(p) || p < 0.5 || p > 5 || Math.round(p * 2) !== p * 2) {
      return "Predicted score must be between 0.5 and 5, in steps of 0.5.";
    }
  }
  if (form.predicted_margin.trim()) {
    const m = Number(form.predicted_margin);
    if (Number.isNaN(m) || m < 0 || m > 4.5) {
      return "Predicted margin must be between 0 and 4.5.";
    }
  }

  return null;
}


export function EditBookModal({
  book,
  allGenres,
  seriesOptions,
  metadataError,
  onRetryMetadata,
  onClose,
  onSaved,
  onDeleted,
}: {
  book: Book;
  allGenres: string[];
  seriesOptions: string[];
  metadataError?: boolean;
  onRetryMetadata?: () => void;
  onClose: () => void;
  onSaved: (book: Book) => void;
  onDeleted?: (bookId: number) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(book));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        `Permanently delete "${book.title}"? This can't be undone -- it removes the book and any ratings, ranking, or answers tied to it.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${book.book_id}`, { method: "DELETE" });
      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responseBody.error || "Delete failed.");
      onDeleted?.(book.book_id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/books/${book.book_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          author: form.author.trim() || null,
          series: form.series.trim() || null,
          series_number: form.series_number.trim() ? Number(form.series_number) : null,
          genre: form.genre || null,
          subgenre: form.subgenre.trim() || null,
          year_released: form.year_released.trim() ? Number(form.year_released) : null,
          year_read: form.year_read.trim() ? Number(form.year_read) : null,
          score: form.score.trim() ? Number(form.score) : null,
          predicted_score: form.predicted_score.trim() ? Number(form.predicted_score) : null,
          predicted_margin: form.predicted_margin.trim() ? Number(form.predicted_margin) : null,
          format_raw: form.format_raw.trim() || null,
          format_type: form.format_type || null,
          word_count: form.word_count.trim() ? Number(form.word_count) : null,
          page_count: form.page_count.trim() ? Number(form.page_count) : null,
          narrator: form.narrator.trim() || null,
          reread: form.reread,
          date_started: form.date_started || null,
          date_finished: form.date_finished || null,
          isbn: form.isbn.trim() || null,
          status: form.status.trim() || null,
        }),
      });

      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(responseBody.error || "Save failed.");
      }

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
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-hairline bg-paper p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-book-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="edit-book-title" className={`${fraunces.className} text-xl font-semibold text-ink`}>
            Edit book
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full px-2 py-1 text-ink-faint hover:bg-hover hover:text-ink"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={modalLabelClass()} htmlFor="field-title">Title</label>
            <input
              id="field-title"
              className={fieldClass()}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className={modalLabelClass()} htmlFor="field-author">Author</label>
            <input
              id="field-author"
              className={fieldClass()}
              value={form.author}
              onChange={(e) => set("author", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={modalLabelClass()} htmlFor="field-series">Series</label>
              <input
                id="field-series"
                className={fieldClass()}
                value={form.series}
                onChange={(e) => set("series", e.target.value)}
                list="series-options"
                placeholder="None"
              />
              <datalist id="series-options">
                {seriesOptions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={modalLabelClass()} htmlFor="field-series-number">Series number</label>
              <input
                id="field-series-number"
                className={fieldClass()}
                type="number"
                step="any"
                value={form.series_number}
                onChange={(e) => set("series_number", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={modalLabelClass()} htmlFor="field-genre">Genre</label>
              <select
                id="field-genre"
                className={fieldClass()}
                value={form.genre}
                onChange={(e) => set("genre", e.target.value)}
              >
                <option value="">None</option>
                {allGenres.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              {metadataError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Couldn&apos;t load genres.{" "}
                  <button type="button" onClick={onRetryMetadata} className="underline decoration-dotted underline-offset-4">
                    Retry
                  </button>
                </p>
              )}
            </div>
            <div>
              <label className={modalLabelClass()} htmlFor="field-format-type">Format type</label>
              <select
                id="field-format-type"
                className={fieldClass()}
                value={form.format_type}
                onChange={(e) => set("format_type", e.target.value)}
              >
                <option value="">None</option>
                {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={modalLabelClass()} htmlFor="field-subgenre">Subgenre</label>
            <input
              id="field-subgenre"
              className={fieldClass()}
              value={form.subgenre}
              onChange={(e) => set("subgenre", e.target.value)}
              placeholder="None"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={modalLabelClass()} htmlFor="field-format-raw">Format (raw)</label>
              <input
                id="field-format-raw"
                className={fieldClass()}
                value={form.format_raw}
                onChange={(e) => set("format_raw", e.target.value)}
                placeholder="e.g. Audible, Kindle Paperwhite"
              />
            </div>
            <div>
              <label className={modalLabelClass()} htmlFor="field-narrator">Narrator</label>
              <input
                id="field-narrator"
                className={fieldClass()}
                value={form.narrator}
                onChange={(e) => set("narrator", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={modalLabelClass()} htmlFor="field-year-read">Year read</label>
              <input
                id="field-year-read"
                className={fieldClass()}
                type="number"
                step="1"
                value={form.year_read}
                onChange={(e) => set("year_read", e.target.value)}
              />
            </div>
            <div>
              <label className={modalLabelClass()} htmlFor="field-year-released">Year released</label>
              <input
                id="field-year-released"
                className={fieldClass()}
                type="number"
                step="1"
                value={form.year_released}
                onChange={(e) => set("year_released", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={modalLabelClass()} htmlFor="field-score">Score</label>
              <input
                id="field-score"
                className={fieldClass()}
                type="number"
                step="0.5"
                min="0.5"
                max="5"
                value={form.score}
                onChange={(e) => set("score", e.target.value)}
              />
            </div>
            <div>
              <label className={modalLabelClass()} htmlFor="field-page-count">Page count</label>
              <input
                id="field-page-count"
                className={fieldClass()}
                type="number"
                step="1"
                value={form.page_count}
                onChange={(e) => set("page_count", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={modalLabelClass()} htmlFor="field-predicted-score">Predicted score</label>
              <input
                id="field-predicted-score"
                className={fieldClass()}
                type="number"
                step="0.5"
                min="0.5"
                max="5"
                value={form.predicted_score}
                onChange={(e) => set("predicted_score", e.target.value)}
              />
            </div>
            <div>
              <label className={modalLabelClass()} htmlFor="field-predicted-margin">Predicted margin (±)</label>
              <input
                id="field-predicted-margin"
                className={fieldClass()}
                type="number"
                step="0.1"
                min="0"
                max="4.5"
                value={form.predicted_margin}
                onChange={(e) => set("predicted_margin", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={modalLabelClass()} htmlFor="field-word-count">Word count</label>
              <input
                id="field-word-count"
                className={fieldClass()}
                type="number"
                step="any"
                value={form.word_count}
                onChange={(e) => set("word_count", e.target.value)}
              />
            </div>
            <div>
              <label className={modalLabelClass()} htmlFor="field-isbn">ISBN</label>
              <input
                id="field-isbn"
                className={fieldClass()}
                value={form.isbn}
                onChange={(e) => set("isbn", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={modalLabelClass()} htmlFor="field-date-started">Date started</label>
              <input
                id="field-date-started"
                className={fieldClass()}
                type="date"
                value={form.date_started}
                onChange={(e) => set("date_started", e.target.value)}
              />
            </div>
            <div>
              <label className={modalLabelClass()} htmlFor="field-date-finished">Date finished</label>
              <input
                id="field-date-finished"
                className={fieldClass()}
                type="date"
                value={form.date_finished}
                onChange={(e) => set("date_finished", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={modalLabelClass()} htmlFor="field-status">Status</label>
              <input
                id="field-status"
                className={fieldClass()}
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                placeholder="e.g. DNF"
              />
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={form.reread}
                  onChange={(e) => set("reread", e.target.checked)}
                  className="accent-accent"
                />
                Reread
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-600 underline decoration-dotted underline-offset-4 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
            >
              {deleting ? "Deleting..." : "Delete book"}
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-hairline px-4 py-1.5 text-sm text-ink-muted hover:text-ink"
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
          </div>
        </form>
      </div>
    </div>
  );
}
