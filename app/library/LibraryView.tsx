"use client";

import { useEffect, useMemo, useState } from "react";
import { BookCard } from "./BookCard";
import { BookTable } from "./BookTable";
import { EditBookModal } from "../shared/EditBookModal";
import { FORMAT_LABELS } from "../shared/formatLabels";
import { CurrentlyReadingPanel } from "../shared/CurrentlyReadingPanel";
import { fraunces } from "../shared/fonts";
import { selectClass, labelClass } from "../shared/formControls";
import { StartBookModal } from "../shared/StartBookModal";
import { titleSortKey } from "../shared/titleSortKey";
import type { Book } from "../shared/bookTypes";

const SORTS = {
  score: {
    label: "Score (highest)",
    compare: (a: Book, b: Book) => (b.score ?? -1) - (a.score ?? -1),
  },
  year_read: {
    label: "Year read (newest)",
    compare: (a: Book, b: Book) => (b.year_read ?? -Infinity) - (a.year_read ?? -Infinity),
  },
  title: {
    label: "Title (A–Z)",
    compare: (a: Book, b: Book) => titleSortKey(a.title).localeCompare(titleSortKey(b.title)),
  },
  page_count: {
    label: "Pages (most)",
    compare: (a: Book, b: Book) => (b.page_count ?? -Infinity) - (a.page_count ?? -Infinity),
  },
  year_released: {
    label: "Publication year (newest)",
    compare: (a: Book, b: Book) => (b.year_released ?? -Infinity) - (a.year_released ?? -Infinity),
  },
  date_finished: {
    label: "Date finished (most recent)",
    compare: (a: Book, b: Book) => {
      const at = a.date_finished ? new Date(a.date_finished).getTime() : -Infinity;
      const bt = b.date_finished ? new Date(b.date_finished).getTime() : -Infinity;
      return bt - at;
    },
  },
} as const;

type SortKey = keyof typeof SORTS;
type ViewMode = "card" | "grid";

const ALL = "__all__";

// Card view has a fixed set of always-visible fields (year read, stars), so
// sorting by anything else needs its value shown explicitly -- otherwise
// sorting by, say, publication year looks like nothing happened because only
// year read is on screen. Title is skipped since the card heading already
// is the title.
function sortValueLabel(book: Book, key: SortKey): string | null {
  switch (key) {
    case "title":
      return null;
    case "score":
      return `Score: ${book.score != null ? book.score.toFixed(1) : "Unrated"}`;
    case "year_read":
      return `Year read: ${book.year_read}`;
    case "page_count":
      return `Pages: ${book.page_count}`;
    case "year_released":
      return `Published: ${book.year_released ?? "Unknown"}`;
    case "date_finished":
      return `Finished: ${book.date_finished ?? "Unknown"}`;
  }
}

export function LibraryView({
  books: initialBooks,
  allGenres,
}: {
  books: Book[];
  allGenres: string[];
}) {
  const [books, setBooks] = useState(initialBooks);
  const [genre, setGenre] = useState(ALL);
  const [format, setFormat] = useState(ALL);
  const [yearRead, setYearRead] = useState(ALL);
  const [yearPublished, setYearPublished] = useState(ALL);
  const [series, setSeries] = useState(ALL);
  const [missingCoversOnly, setMissingCoversOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("year_read");
  const [view, setView] = useState<ViewMode>("card");
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [showStartBook, setShowStartBook] = useState(false);

  const genres = useMemo(
    () =>
      Array.from(new Set(books.map((b) => b.genre).filter((g): g is string => g != null))).sort(),
    [books]
  );
  const formats = useMemo(
    () =>
      Array.from(
        new Set(books.map((b) => b.format_type).filter((f): f is string => f != null))
      ).sort(),
    [books]
  );
  const years = useMemo(
    () =>
      Array.from(
        new Set(books.map((b) => b.year_read).filter((y): y is number => y != null))
      ).sort((a, b) => b - a),
    [books]
  );
  const yearsPublished = useMemo(
    () =>
      Array.from(
        new Set(books.filter((b) => b.year_released != null).map((b) => b.year_released as number))
      ).sort((a, b) => b - a),
    [books]
  );
  const seriesList = useMemo(
    () =>
      Array.from(new Set(books.filter((b) => b.series).map((b) => b.series as string))).sort(),
    [books]
  );

  // Filtering is shared between both views. Sorting is not: Card view uses
  // the "Sort by" dropdown below, Grid view sorts via its own clickable
  // column headers -- so only Card view applies SORTS here.
  const filtered = useMemo(() => {
    return books
      .filter((b) => genre === ALL || b.genre === genre)
      .filter((b) => format === ALL || b.format_type === format)
      .filter((b) => yearRead === ALL || String(b.year_read) === yearRead)
      .filter((b) => yearPublished === ALL || String(b.year_released) === yearPublished)
      .filter((b) => series === ALL || b.series === series)
      .filter((b) => !missingCoversOnly || !b.cover_url);
  }, [books, genre, format, yearRead, yearPublished, series, missingCoversOnly]);

  const cardSorted = useMemo(
    () => [...filtered].sort(SORTS[sortKey].compare),
    [filtered, sortKey]
  );

  const missingCoverCount = useMemo(
    () => books.filter((b) => !b.cover_url).length,
    [books]
  );

  const filtersActive =
    genre !== ALL ||
    format !== ALL ||
    yearRead !== ALL ||
    yearPublished !== ALL ||
    series !== ALL ||
    missingCoversOnly;

  function clearFilters() {
    setGenre(ALL);
    setFormat(ALL);
    setYearRead(ALL);
    setYearPublished(ALL);
    setSeries(ALL);
    setMissingCoversOnly(false);
  }

  function handleCoverChange(bookId: number, coverUrl: string | null) {
    setBooks((prev) => prev.map((b) => (b.book_id === bookId ? { ...b, cover_url: coverUrl } : b)));
  }

  function handleBookSaved(updated: Book) {
    setBooks((prev) => prev.map((b) => (b.book_id === updated.book_id ? updated : b)));
    setEditingBookId(null);
  }

  function handleBookDeleted(bookId: number) {
    setBooks((prev) => prev.filter((b) => b.book_id !== bookId));
    setEditingBookId(null);
  }

  const editingBook = books.find((b) => b.book_id === editingBookId) ?? null;

  // A book finished via the CurrentlyReadingPanel embedded on this page never
  // came from the server-rendered initialBooks (it was status='reading' at
  // load time, excluded by the library query) -- so it has to be merged in
  // here directly rather than relying on a re-fetch.
  useEffect(() => {
    function handleFinished(e: Event) {
      const finished = (e as CustomEvent<Book>).detail;
      if (!finished) return;
      setBooks((prev) => {
        const exists = prev.some((b) => b.book_id === finished.book_id);
        return exists
          ? prev.map((b) => (b.book_id === finished.book_id ? finished : b))
          : [...prev, finished];
      });
    }
    window.addEventListener("book:finished", handleFinished);
    return () => window.removeEventListener("book:finished", handleFinished);
  }, []);

  return (
    <div className="min-h-full flex-1 bg-paper px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className={`${fraunces.className} text-3xl font-semibold text-ink sm:text-4xl`}>
              Library
            </h1>
            <p className="mt-1 text-sm text-ink-faint">
              Showing {filtered.length} of {books.length} books
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowStartBook(true)}
              className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent shadow-sm transition hover:brightness-95"
            >
              Start a book
            </button>

            <div className="flex gap-1 rounded-full border border-hairline bg-card/70 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setView("card")}
                aria-pressed={view === "card"}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  view === "card" ? "bg-accent text-on-accent" : "text-ink-muted hover:text-ink"
                }`}
              >
                Card
              </button>
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-pressed={view === "grid"}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  view === "grid" ? "bg-accent text-on-accent" : "text-ink-muted hover:text-ink"
                }`}
              >
                Grid
              </button>
            </div>
          </div>
        </header>

        <CurrentlyReadingPanel />

        <div className="sticky top-0 z-10 -mx-4 mb-8 border-b border-hairline bg-paper/90 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className={labelClass()} htmlFor="filter-genre">
                Genre
              </label>
              <select
                id="filter-genre"
                className={selectClass()}
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              >
                <option value={ALL}>All genres</option>
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelClass()} htmlFor="filter-format">
                Format
              </label>
              <select
                id="filter-format"
                className={selectClass()}
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value={ALL}>All formats</option>
                {formats.map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABELS[f] ?? f}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelClass()} htmlFor="filter-year">
                Year read
              </label>
              <select
                id="filter-year"
                className={selectClass()}
                value={yearRead}
                onChange={(e) => setYearRead(e.target.value)}
              >
                <option value={ALL}>All years</option>
                {years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelClass()} htmlFor="filter-year-published">
                Year published
              </label>
              <select
                id="filter-year-published"
                className={selectClass()}
                value={yearPublished}
                onChange={(e) => setYearPublished(e.target.value)}
              >
                <option value={ALL}>All years</option>
                {yearsPublished.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelClass()} htmlFor="filter-series">
                Series
              </label>
              <select
                id="filter-series"
                className={selectClass()}
                value={series}
                onChange={(e) => setSeries(e.target.value)}
              >
                <option value={ALL}>All series</option>
                {seriesList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {view === "card" && (
              <div className="flex flex-col gap-1">
                <label className={labelClass()} htmlFor="sort-by">
                  Sort by
                </label>
                <select
                  id="sort-by"
                  className={selectClass()}
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                >
                  {Object.entries(SORTS).map(([key, { label }]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <span className={labelClass()}>Covers</span>
              <label className="flex items-center gap-2 rounded-full border border-hairline bg-card/70 px-3 py-1.5 text-sm text-ink shadow-sm">
                <input
                  type="checkbox"
                  checked={missingCoversOnly}
                  onChange={(e) => setMissingCoversOnly(e.target.checked)}
                  className="accent-accent"
                />
                Missing only ({missingCoverCount})
              </label>
            </div>

            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto text-sm text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-faint">
            No books match these filters.
          </p>
        ) : view === "card" ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {cardSorted.map((book) => (
              <BookCard
                key={book.book_id}
                book={book}
                onCoverChange={handleCoverChange}
                onEditRequest={setEditingBookId}
                sortValueLabel={sortValueLabel(book, sortKey)}
              />
            ))}
          </div>
        ) : (
          <BookTable books={filtered} onCoverChange={handleCoverChange} onEditRequest={setEditingBookId} />
        )}
      </div>

      {editingBook && (
        <EditBookModal
          book={editingBook}
          allGenres={allGenres}
          seriesOptions={seriesList}
          onClose={() => setEditingBookId(null)}
          onSaved={handleBookSaved}
          onDeleted={handleBookDeleted}
        />
      )}

      {showStartBook && (
        <StartBookModal
          onClose={() => setShowStartBook(false)}
          onStarted={() => setShowStartBook(false)}
        />
      )}
    </div>
  );
}
