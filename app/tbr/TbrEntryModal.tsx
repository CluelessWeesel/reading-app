"use client";

import { useEffect, useState } from "react";
import { fraunces } from "../shared/fonts";
import { fieldClass, modalLabelClass } from "../shared/formControls";
import type { TbrEntry } from "./types";

type FormState = {
  title: string;
  author: string;
  genre: string;
  subgenre: string;
  word_count: string;
  page_count: string;
  owned_or_format: string;
  owned: "unsorted" | "owned" | "not_owned";
};

function toFormState(entry: TbrEntry | null): FormState {
  if (!entry) {
    return {
      title: "",
      author: "",
      genre: "",
      subgenre: "",
      word_count: "",
      page_count: "",
      owned_or_format: "",
      owned: "unsorted",
    };
  }
  return {
    title: entry.title,
    author: entry.author ?? "",
    genre: entry.genre ?? "",
    subgenre: entry.subgenre ?? "",
    word_count: entry.word_count != null ? String(entry.word_count) : "",
    page_count: entry.page_count != null ? String(entry.page_count) : "",
    owned_or_format: entry.owned_or_format ?? "",
    owned: entry.owned == null ? "unsorted" : entry.owned ? "owned" : "not_owned",
  };
}

function validate(form: FormState): string | null {
  if (!form.title.trim()) return "Title is required.";
  if (form.word_count.trim()) {
    const n = Number(form.word_count);
    if (Number.isNaN(n) || !Number.isInteger(n) || n < 0) {
      return "Word count must be a non-negative whole number.";
    }
  }
  if (form.page_count.trim()) {
    const n = Number(form.page_count);
    if (Number.isNaN(n) || !Number.isInteger(n) || n < 0) {
      return "Page count must be a non-negative whole number.";
    }
  }
  return null;
}

export function TbrEntryModal({
  entry,
  allGenres,
  subgenreOptions,
  ownedFormatOptions,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: TbrEntry | null; // null = adding a new entry
  allGenres: string[];
  subgenreOptions: string[];
  ownedFormatOptions: string[];
  onClose: () => void;
  onSaved: (entry: TbrEntry) => void;
  onDeleted: (id: number) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(entry));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

    const payload = {
      title: form.title.trim(),
      author: form.author.trim() || null,
      genre: form.genre.trim() || null,
      subgenre: form.subgenre.trim() || null,
      word_count: form.word_count.trim() ? Number(form.word_count) : null,
      page_count: form.page_count.trim() ? Number(form.page_count) : null,
      owned_or_format: form.owned_or_format.trim() || null,
      owned: form.owned === "unsorted" ? null : form.owned === "owned",
    };

    try {
      const res = entry
        ? await fetch(`/api/tbr/${entry.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/tbr`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(responseBody.error || "Save failed.");
      }
      onSaved(responseBody);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    if (!window.confirm(`Delete "${entry.title}" from your TBR?`)) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tbr/${entry.id}`, { method: "DELETE" });
      if (!res.ok) {
        const responseBody = await res.json().catch(() => ({}));
        throw new Error(responseBody.error || "Delete failed.");
      }
      onDeleted(entry.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
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
        aria-labelledby="tbr-modal-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="tbr-modal-title" className={`${fraunces.className} text-xl font-semibold text-ink-warm`}>
            {entry ? "Edit TBR entry" : "Add TBR entry"}
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
            <label className={modalLabelClass()} htmlFor="tbr-title">Title</label>
            <input
              id="tbr-title"
              className={fieldClass()}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className={modalLabelClass()} htmlFor="tbr-author">Author</label>
            <input
              id="tbr-author"
              className={fieldClass()}
              value={form.author}
              onChange={(e) => set("author", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={modalLabelClass()} htmlFor="tbr-genre">Genre</label>
              <select
                id="tbr-genre"
                className={fieldClass()}
                value={form.genre}
                onChange={(e) => set("genre", e.target.value)}
              >
                <option value="">None</option>
                {allGenres.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={modalLabelClass()} htmlFor="tbr-subgenre">Subgenre</label>
              <input
                id="tbr-subgenre"
                className={fieldClass()}
                value={form.subgenre}
                onChange={(e) => set("subgenre", e.target.value)}
                list="tbr-subgenre-options"
              />
              <datalist id="tbr-subgenre-options">
                {subgenreOptions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={modalLabelClass()} htmlFor="tbr-word-count">Word count</label>
              <input
                id="tbr-word-count"
                className={fieldClass()}
                type="number"
                step="1"
                min="0"
                value={form.word_count}
                onChange={(e) => set("word_count", e.target.value)}
              />
            </div>
            <div>
              <label className={modalLabelClass()} htmlFor="tbr-page-count">Page count</label>
              <input
                id="tbr-page-count"
                className={fieldClass()}
                type="number"
                step="1"
                min="0"
                value={form.page_count}
                onChange={(e) => set("page_count", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={modalLabelClass()} htmlFor="tbr-owned-format">Owned / format</label>
              <input
                id="tbr-owned-format"
                className={fieldClass()}
                value={form.owned_or_format}
                onChange={(e) => set("owned_or_format", e.target.value)}
                list="owned-format-options"
              />
              <datalist id="owned-format-options">
                {ownedFormatOptions.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={modalLabelClass()} htmlFor="tbr-owned">Owned</label>
              <select
                id="tbr-owned"
                className={fieldClass()}
                value={form.owned}
                onChange={(e) => set("owned", e.target.value as FormState["owned"])}
              >
                <option value="unsorted">Unsorted</option>
                <option value="owned">Owned</option>
                <option value="not_owned">Not owned</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            {entry ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm text-red-600 underline decoration-dotted underline-offset-4 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            ) : (
              <span />
            )}

            <div className="flex gap-3">
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
          </div>
        </form>
      </div>
    </div>
  );
}
