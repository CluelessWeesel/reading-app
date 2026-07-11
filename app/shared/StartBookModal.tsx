"use client";

import { useEffect, useMemo, useState } from "react";
import { fraunces } from "./fonts";
import { fieldClass, modalLabelClass } from "./formControls";
import { titleSortKey } from "./titleSortKey";

type TbrOption = {
  id: number;
  title: string;
  author: string | null;
  genre: string | null;
  word_count: number | null;
};

const FORMAT_OPTIONS = [
  { value: "physical", label: "Physical" },
  { value: "ebook", label: "Ebook" },
  { value: "audio", label: "Audiobook" },
];

export function StartBookModal({
  initialTbrEntry = null,
  onClose,
  onStarted,
  onTbrEntryConsumed,
}: {
  initialTbrEntry?: TbrOption | null;
  onClose: () => void;
  onStarted: () => void;
  onTbrEntryConsumed?: (tbrId: number) => void;
}) {
  const [mode, setMode] = useState<"tbr" | "new">("tbr");
  const [tbrOptions, setTbrOptions] = useState<TbrOption[] | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTbr, setSelectedTbr] = useState<TbrOption | null>(initialTbrEntry);

  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");

  const [formatType, setFormatType] = useState("physical");
  const [wordCount, setWordCount] = useState(
    initialTbrEntry?.word_count != null ? String(initialTbrEntry.word_count) : ""
  );
  const [pageCount, setPageCount] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (mode !== "tbr" || initialTbrEntry || tbrOptions !== null) return;
    fetch("/api/tbr")
      .then((res) => res.json())
      .then((data) => setTbrOptions(Array.isArray(data) ? data : []))
      .catch(() => setError("Couldn't load your TBR list."));
  }, [mode, initialTbrEntry, tbrOptions]);

  const filteredTbr = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tbrOptions ?? [])
      .filter((t) => !q || t.title.toLowerCase().includes(q) || (t.author ?? "").toLowerCase().includes(q))
      .sort((a, b) => titleSortKey(a.title).localeCompare(titleSortKey(b.title)));
  }, [tbrOptions, search]);

  function selectTbr(entry: TbrOption) {
    setSelectedTbr(entry);
    setWordCount(entry.word_count != null ? String(entry.word_count) : "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (wordCount.trim() && (Number.isNaN(Number(wordCount)) || Number(wordCount) < 0)) {
      setError("Word count must be a non-negative number.");
      return;
    }
    if (pageCount.trim() && (!Number.isInteger(Number(pageCount)) || Number(pageCount) <= 0)) {
      setError("Page count must be a positive whole number.");
      return;
    }
    if (mode === "tbr" && !selectedTbr) {
      setError("Pick a TBR entry, or switch to typing a new title.");
      return;
    }
    if (mode === "new" && !newTitle.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    const payload =
      mode === "tbr"
        ? {
            source: "tbr",
            tbrId: selectedTbr!.id,
            format_type: formatType,
            word_count: wordCount.trim() ? Number(wordCount) : null,
            page_count: pageCount.trim() ? Number(pageCount) : null,
          }
        : {
            source: "new",
            title: newTitle.trim(),
            author: newAuthor.trim() || null,
            format_type: formatType,
            word_count: wordCount.trim() ? Number(wordCount) : null,
            page_count: pageCount.trim() ? Number(pageCount) : null,
          };

    try {
      const res = await fetch("/api/start-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(responseBody.error || "Failed to start book.");
      }

      window.dispatchEvent(new Event("current-books:changed"));
      if (mode === "tbr" && selectedTbr && onTbrEntryConsumed) {
        onTbrEntryConsumed(selectedTbr.id);
      }
      onStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start book.");
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-hairline bg-paper p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-book-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="start-book-title" className={`${fraunces.className} text-xl font-semibold text-ink`}>
            Start a book
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
          {!initialTbrEntry && (
            <div className="flex gap-1 rounded-full border border-hairline bg-card/70 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setMode("tbr")}
                className={`flex-1 rounded-full px-3 py-1 text-sm transition ${
                  mode === "tbr" ? "bg-accent text-on-accent" : "text-ink-muted hover:text-ink"
                }`}
              >
                From TBR
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`flex-1 rounded-full px-3 py-1 text-sm transition ${
                  mode === "new" ? "bg-accent text-on-accent" : "text-ink-muted hover:text-ink"
                }`}
              >
                New title
              </button>
            </div>
          )}

          {mode === "tbr" ? (
            <div>
              <label className={modalLabelClass()}>TBR entry</label>
              {selectedTbr ? (
                <div className="flex items-center justify-between rounded-lg border border-hairline bg-card/70 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-ink">{selectedTbr.title}</p>
                    {selectedTbr.author && <p className="text-xs text-ink-faint">{selectedTbr.author}</p>}
                  </div>
                  {!initialTbrEntry && (
                    <button
                      type="button"
                      onClick={() => setSelectedTbr(null)}
                      className="text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
                    >
                      Change
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search your TBR..."
                    className={fieldClass()}
                    autoFocus
                  />
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-hairline">
                    {tbrOptions === null ? (
                      <p className="p-3 text-sm text-ink-faint">Loading...</p>
                    ) : filteredTbr.length === 0 ? (
                      <p className="p-3 text-sm text-ink-faint">No matches.</p>
                    ) : (
                      filteredTbr.slice(0, 30).map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => selectTbr(entry)}
                          className="block w-full border-b border-hairline px-3 py-2 text-left text-sm last:border-0 hover:bg-hover"
                        >
                          <span className="font-medium text-ink">{entry.title}</span>
                          {entry.author && <span className="text-ink-faint"> — {entry.author}</span>}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className={modalLabelClass()} htmlFor="start-title">Title</label>
                <input
                  id="start-title"
                  className={fieldClass()}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className={modalLabelClass()} htmlFor="start-author">Author (optional)</label>
                <input
                  id="start-author"
                  className={fieldClass()}
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <label className={modalLabelClass()} htmlFor="start-format">Format</label>
            <select
              id="start-format"
              className={fieldClass()}
              value={formatType}
              onChange={(e) => setFormatType(e.target.value)}
            >
              {FORMAT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={modalLabelClass()} htmlFor="start-word-count">Word count (optional)</label>
              <input
                id="start-word-count"
                className={fieldClass()}
                type="number"
                step="any"
                min="0"
                value={wordCount}
                onChange={(e) => setWordCount(e.target.value)}
              />
            </div>
            <div>
              <label className={modalLabelClass()} htmlFor="start-page-count">Page count (optional)</label>
              <input
                id="start-page-count"
                className={fieldClass()}
                type="number"
                step="1"
                min="1"
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
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
              {saving ? "Starting..." : "Start reading"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
