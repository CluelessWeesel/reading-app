"use client";

import { useEffect, useState } from "react";
import { fetchBookMetadata } from "../bookMetadata";
import type { Book } from "../bookTypes";
import { fieldClass, modalLabelClass } from "../formControls";
import { FORMAT_LABELS } from "../formatLabels";
import { todayLocalIso } from "../isoDate";
import { CeremonyStepShell } from "./CeremonyStepShell";

type FormState = {
  title: string;
  author: string;
  series: string;
  series_number: string;
  genre: string;
  year_released: string;
  format_raw: string;
  format_type: string;
  word_count: string;
  page_count: string;
  narrator: string;
  reread: boolean;
  date_started: string;
  date_finished: string;
  isbn: string;
};

function toFormState(book: Book): FormState {
  return {
    title: book.title,
    author: book.author ?? "",
    series: book.series ?? "",
    series_number: book.series_number != null ? String(book.series_number) : "",
    genre: book.genre ?? "",
    year_released: book.year_released != null ? String(book.year_released) : "",
    format_raw: book.format_raw ?? "",
    format_type: book.format_type ?? "",
    word_count: book.word_count != null ? String(book.word_count) : "",
    page_count: book.page_count != null ? String(book.page_count) : "",
    narrator: book.narrator ?? "",
    reread: book.reread,
    date_started: book.date_started ?? "",
    date_finished: book.date_finished ?? todayLocalIso(),
    isbn: book.isbn ?? "",
  };
}

function validate(form: FormState): string | null {
  if (!form.title.trim()) return "Title is required.";
  if (form.series_number.trim() && Number.isNaN(Number(form.series_number))) {
    return "Series number must be a number.";
  }
  if (form.year_released.trim() && !Number.isInteger(Number(form.year_released))) {
    return "Year released must be a whole number.";
  }
  if (form.word_count.trim() && Number.isNaN(Number(form.word_count))) {
    return "Word count must be a number.";
  }
  if (form.page_count.trim()) {
    const p = Number(form.page_count);
    if (!Number.isInteger(p) || p <= 0) return "Page count must be a positive whole number.";
  }
  if (form.date_started && form.date_finished && form.date_started > form.date_finished) {
    return "Date finished can't be before date started.";
  }
  return null;
}

export function ConfirmDetailsStep({
  book,
  stepIndex,
  totalSteps,
  onNext,
}: {
  book: Book;
  stepIndex: number;
  totalSteps: number;
  onNext: (updated: Book) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(book));
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [seriesOptions, setSeriesOptions] = useState<string[]>([]);
  const [metadataError, setMetadataError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function loadMetadata() {
    setMetadataError(false);
    fetchBookMetadata()
      .then((data) => {
        setAllGenres(data.genres);
        setSeriesOptions(data.series);
      })
      .catch(() => setMetadataError(true));
  }

  useEffect(() => {
    loadMetadata();
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleNext() {
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      author: form.author.trim() || null,
      series: form.series.trim() || null,
      series_number: form.series_number.trim() ? Number(form.series_number) : null,
      genre: form.genre || null,
      year_released: form.year_released.trim() ? Number(form.year_released) : null,
      year_read: book.year_read,
      score: book.score,
      format_raw: form.format_raw.trim() || null,
      format_type: form.format_type || null,
      word_count: form.word_count.trim() ? Number(form.word_count) : null,
      page_count: form.page_count.trim() ? Number(form.page_count) : null,
      narrator: form.narrator.trim() || null,
      reread: form.reread,
      date_started: form.date_started || null,
      date_finished: form.date_finished || null,
      isbn: form.isbn.trim() || null,
      status: book.status,
      review: book.review,
    };

    try {
      const res = await fetch(`/api/books/${book.book_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responseBody.error || "Save failed.");
      onNext({ ...book, ...responseBody });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CeremonyStepShell
      title="Confirm details"
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      onNext={handleNext}
      nextLabel={saving ? "Saving..." : "Next"}
      nextDisabled={saving}
    >
      <div className="space-y-4">
        <div>
          <label className={modalLabelClass()} htmlFor="cf-title">Title</label>
          <input id="cf-title" className={fieldClass()} value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus />
        </div>
        <div>
          <label className={modalLabelClass()} htmlFor="cf-author">Author</label>
          <input id="cf-author" className={fieldClass()} value={form.author} onChange={(e) => set("author", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={modalLabelClass()} htmlFor="cf-series">Series</label>
            <input id="cf-series" className={fieldClass()} value={form.series} onChange={(e) => set("series", e.target.value)} list="cf-series-options" placeholder="None" />
            <datalist id="cf-series-options">
              {seriesOptions.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <label className={modalLabelClass()} htmlFor="cf-series-number">Series number</label>
            <input id="cf-series-number" className={fieldClass()} type="number" step="any" value={form.series_number} onChange={(e) => set("series_number", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={modalLabelClass()} htmlFor="cf-genre">Genre</label>
            <select id="cf-genre" className={fieldClass()} value={form.genre} onChange={(e) => set("genre", e.target.value)}>
              <option value="">None</option>
              {allGenres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            {metadataError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Couldn&apos;t load genres.{" "}
                <button type="button" onClick={loadMetadata} className="underline decoration-dotted underline-offset-4">
                  Retry
                </button>
              </p>
            )}
          </div>
          <div>
            <label className={modalLabelClass()} htmlFor="cf-format-type">Format type</label>
            <select id="cf-format-type" className={fieldClass()} value={form.format_type} onChange={(e) => set("format_type", e.target.value)}>
              <option value="">None</option>
              {Object.entries(FORMAT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={modalLabelClass()} htmlFor="cf-format-raw">Format (raw)</label>
            <input id="cf-format-raw" className={fieldClass()} value={form.format_raw} onChange={(e) => set("format_raw", e.target.value)} placeholder="e.g. Audible" />
          </div>
          <div>
            <label className={modalLabelClass()} htmlFor="cf-narrator">Narrator</label>
            <input id="cf-narrator" className={fieldClass()} value={form.narrator} onChange={(e) => set("narrator", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={modalLabelClass()} htmlFor="cf-year-released">Year released</label>
            <input id="cf-year-released" className={fieldClass()} type="number" step="1" value={form.year_released} onChange={(e) => set("year_released", e.target.value)} />
          </div>
          <div>
            <label className={modalLabelClass()} htmlFor="cf-isbn">ISBN</label>
            <input id="cf-isbn" className={fieldClass()} value={form.isbn} onChange={(e) => set("isbn", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={modalLabelClass()} htmlFor="cf-word-count">Word count</label>
            <input id="cf-word-count" className={fieldClass()} type="number" step="any" value={form.word_count} onChange={(e) => set("word_count", e.target.value)} />
          </div>
          <div>
            <label className={modalLabelClass()} htmlFor="cf-page-count">Page count</label>
            <input id="cf-page-count" className={fieldClass()} type="number" step="1" value={form.page_count} onChange={(e) => set("page_count", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={modalLabelClass()} htmlFor="cf-date-started">Date started</label>
            <input id="cf-date-started" className={fieldClass()} type="date" value={form.date_started} onChange={(e) => set("date_started", e.target.value)} />
          </div>
          <div>
            <label className={modalLabelClass()} htmlFor="cf-date-finished">Date finished</label>
            <input id="cf-date-finished" className={fieldClass()} type="date" value={form.date_finished} onChange={(e) => set("date_finished", e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={form.reread} onChange={(e) => set("reread", e.target.checked)} className="accent-accent" />
          Reread
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </CeremonyStepShell>
  );
}
