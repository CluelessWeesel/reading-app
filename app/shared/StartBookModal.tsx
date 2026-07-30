"use client";

import { useEffect, useState } from "react";
import { fraunces } from "./fonts";
import { fieldClass, modalLabelClass } from "./formControls";
import { todayLocalIso } from "./isoDate";
import { BookCombobox } from "./BookCombobox";
import { CoverThumb } from "./CoverThumb";

type TbrOption = {
  id: number;
  title: string;
  author: string | null;
  genre: string | null;
  cover_url: string | null;
  word_count: number | null;
  page_count: number | null;
};

// Matches /api/books/picker's response shape -- used to search the
// already-read library from "New title" mode, so a reread doesn't have to
// be retyped from scratch.
type LibraryOption = {
  id: number;
  title: string;
  author: string | null;
  cover_url: string | null;
  genre: string | null;
  subgenre: string | null;
  word_count: number | null;
  page_count: number | null;
  last_activity: string | null;
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
  const [selectedTbr, setSelectedTbr] = useState<TbrOption | null>(initialTbrEntry);

  const [newEntryMode, setNewEntryMode] = useState<"search" | "manual">("search");
  const [matchedBook, setMatchedBook] = useState<LibraryOption | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");

  const [formatType, setFormatType] = useState("physical");
  const [wordCount, setWordCount] = useState(
    initialTbrEntry?.word_count != null ? String(initialTbrEntry.word_count) : ""
  );
  const [pageCount, setPageCount] = useState(
    initialTbrEntry?.page_count != null ? String(initialTbrEntry.page_count) : ""
  );

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

  function selectTbr(entry: TbrOption) {
    setSelectedTbr(entry);
    setWordCount(entry.word_count != null ? String(entry.word_count) : "");
    setPageCount(entry.page_count != null ? String(entry.page_count) : "");
  }

  function selectMatchedBook(book: LibraryOption) {
    setMatchedBook(book);
    setWordCount(book.word_count != null ? String(book.word_count) : "");
    setPageCount(book.page_count != null ? String(book.page_count) : "");
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
    if (mode === "new" && newEntryMode === "search" && !matchedBook) {
      setError("Pick a book, or switch to typing a new title.");
      return;
    }
    if (mode === "new" && newEntryMode === "manual" && !newTitle.trim()) {
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
            date_started: todayLocalIso(),
          }
        : newEntryMode === "search"
          ? {
              source: "new",
              title: matchedBook!.title,
              author: matchedBook!.author,
              genre: matchedBook!.genre,
              subgenre: matchedBook!.subgenre,
              cover_url: matchedBook!.cover_url,
              format_type: formatType,
              word_count: wordCount.trim() ? Number(wordCount) : null,
              page_count: pageCount.trim() ? Number(pageCount) : null,
              date_started: todayLocalIso(),
            }
          : {
              source: "new",
              title: newTitle.trim(),
              author: newAuthor.trim() || null,
              format_type: formatType,
              word_count: wordCount.trim() ? Number(wordCount) : null,
              page_count: pageCount.trim() ? Number(pageCount) : null,
              date_started: todayLocalIso(),
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gold bg-surface-3 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-book-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="start-book-title" className={`${fraunces.className} text-xl font-semibold text-ink-warm`}>
            Start a book
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
          {!initialTbrEntry && (
            <div className="flex gap-1 rounded-full border border-gold bg-surface-1 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setMode("tbr")}
                className={`flex-1 rounded-full px-3 py-1 text-sm transition ${
                  mode === "tbr" ? "bg-accent text-on-accent" : "text-ink-warm-muted hover:text-ink-warm"
                }`}
              >
                From TBR
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`flex-1 rounded-full px-3 py-1 text-sm transition ${
                  mode === "new" ? "bg-accent text-on-accent" : "text-ink-warm-muted hover:text-ink-warm"
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
                <div className="flex items-center justify-between rounded-lg border border-gold bg-surface-1 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-ink-warm">{selectedTbr.title}</p>
                    {selectedTbr.author && <p className="text-xs text-ink-warm-faint">{selectedTbr.author}</p>}
                  </div>
                  {!initialTbrEntry && (
                    <button
                      type="button"
                      onClick={() => setSelectedTbr(null)}
                      className="text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
                    >
                      Change
                    </button>
                  )}
                </div>
              ) : tbrOptions === null ? (
                <p className="p-3 text-sm text-ink-warm-faint">Loading...</p>
              ) : (
                <BookCombobox<TbrOption>
                  items={tbrOptions}
                  onSelect={selectTbr}
                  placeholder="Search your TBR..."
                  autoFocus
                />
              )}
            </div>
          ) : matchedBook ? (
            <div>
              <label className={modalLabelClass()}>Title</label>
              <div className="flex items-center justify-between rounded-lg border border-gold bg-surface-1 px-3 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <CoverThumb title={matchedBook.title} coverUrl={matchedBook.cover_url} className="aspect-[2/3] w-10" />
                  <div>
                    <p className="font-medium text-ink-warm">{matchedBook.title}</p>
                    {matchedBook.author && <p className="text-xs text-ink-warm-faint">{matchedBook.author}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMatchedBook(null)}
                  className="text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
                >
                  Change
                </button>
              </div>
            </div>
          ) : newEntryMode === "search" ? (
            <div>
              <label className={modalLabelClass()}>Title</label>
              <BookCombobox<LibraryOption>
                onSelect={selectMatchedBook}
                placeholder="Search your library..."
                autoFocus
              />
              <button
                type="button"
                onClick={() => setNewEntryMode("manual")}
                className="mt-2 text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
              >
                Can&apos;t find it? Type a new title instead
              </button>
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
              <button
                type="button"
                onClick={() => setNewEntryMode("search")}
                className="text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
              >
                Search your library instead
              </button>
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
              className="rounded-full border border-gold px-4 py-1.5 text-sm text-ink-warm-muted hover:text-ink-warm"
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
