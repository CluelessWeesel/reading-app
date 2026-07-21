"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookCard } from "./BookCard";
import { BookTable } from "./BookTable";
import { EditBookModal } from "../shared/EditBookModal";
import { FORMAT_LABELS } from "../shared/formatLabels";
import { CurrentlyReadingPanel } from "../shared/CurrentlyReadingPanel";
import { fraunces } from "../shared/fonts";
import { selectClass, labelClass } from "../shared/formControls";
import { StartBookModal } from "../shared/StartBookModal";
import { titleSortKey } from "../shared/titleSortKey";
import { authorSortKey } from "../shared/authorSortKey";
import { daysBetweenInclusive } from "../shared/isoDate";
import type { Book } from "../shared/bookTypes";

type SortDirection = "asc" | "desc";

type SortField = {
  key: string;
  label: string;
  ascLabel: string;
  descLabel: string;
  // Whether this book has no value for this field -- missing books always
  // sort to the end, regardless of direction, rather than jumping to the
  // front on a reversed sort.
  isMissing: (b: Book) => boolean;
  // Only ever called when neither book is missing. Ascending sense (a<b is
  // negative); descending is just this negated.
  compareAsc: (a: Book, b: Book) => number;
};

function daysTaken(b: Book): number | null {
  if (!b.date_started || !b.date_finished) return null;
  const days = daysBetweenInclusive(b.date_started, b.date_finished);
  return days > 0 ? days : null;
}

function readingPace(b: Book): number | null {
  const days = daysTaken(b);
  if (days == null || b.page_count == null) return null;
  return b.page_count / days;
}

// Kept in alphabetical order by label -- that's the order the dropdown
// renders them in, so no separate sort-for-display step is needed.
const SORT_FIELDS: SortField[] = [
  {
    key: "author",
    label: "Author",
    ascLabel: "A–Z",
    descLabel: "Z–A",
    isMissing: (b) => !b.author,
    compareAsc: (a, b) =>
      authorSortKey(a.author as string).localeCompare(authorSortKey(b.author as string)),
  },
  {
    key: "date_finished",
    label: "Date finished",
    ascLabel: "Earliest",
    descLabel: "Most recent",
    isMissing: (b) => !b.date_finished,
    compareAsc: (a, b) => (a.date_finished as string).localeCompare(b.date_finished as string),
  },
  {
    key: "date_started",
    label: "Date started",
    ascLabel: "Earliest",
    descLabel: "Most recent",
    isMissing: (b) => !b.date_started,
    compareAsc: (a, b) => (a.date_started as string).localeCompare(b.date_started as string),
  },
  {
    key: "days_taken",
    label: "Days taken",
    ascLabel: "Shortest",
    descLabel: "Longest",
    isMissing: (b) => daysTaken(b) == null,
    compareAsc: (a, b) => (daysTaken(a) as number) - (daysTaken(b) as number),
  },
  {
    key: "page_count",
    label: "Pages",
    ascLabel: "Fewest",
    descLabel: "Most",
    isMissing: (b) => b.page_count == null,
    compareAsc: (a, b) => (a.page_count as number) - (b.page_count as number),
  },
  {
    key: "year_released",
    label: "Publication year",
    ascLabel: "Oldest",
    descLabel: "Newest",
    isMissing: (b) => b.year_released == null,
    compareAsc: (a, b) => (a.year_released as number) - (b.year_released as number),
  },
  {
    key: "pace",
    label: "Reading pace",
    ascLabel: "Slowest",
    descLabel: "Fastest",
    isMissing: (b) => readingPace(b) == null,
    compareAsc: (a, b) => (readingPace(a) as number) - (readingPace(b) as number),
  },
  {
    key: "score",
    label: "Score",
    ascLabel: "Lowest",
    descLabel: "Highest",
    isMissing: (b) => b.score == null,
    compareAsc: (a, b) => (a.score as number) - (b.score as number),
  },
  {
    key: "series",
    label: "Series",
    ascLabel: "A–Z",
    descLabel: "Z–A",
    isMissing: (b) => !b.series,
    compareAsc: (a, b) => {
      const seriesCmp = (a.series as string).localeCompare(b.series as string);
      if (seriesCmp !== 0) return seriesCmp;
      return (a.series_number ?? Infinity) - (b.series_number ?? Infinity);
    },
  },
  {
    key: "title",
    label: "Title",
    ascLabel: "A–Z",
    descLabel: "Z–A",
    isMissing: () => false,
    compareAsc: (a, b) => titleSortKey(a.title).localeCompare(titleSortKey(b.title)),
  },
  {
    key: "word_count",
    label: "Word count",
    ascLabel: "Fewest",
    descLabel: "Most",
    isMissing: (b) => b.word_count == null,
    compareAsc: (a, b) => (a.word_count as number) - (b.word_count as number),
  },
  {
    key: "year_read",
    label: "Year read",
    ascLabel: "Oldest",
    descLabel: "Newest",
    isMissing: (b) => b.year_read == null,
    compareAsc: (a, b) => (a.year_read as number) - (b.year_read as number),
  },
];

function compareBooks(field: SortField, direction: SortDirection) {
  return (a: Book, b: Book) => {
    const aMissing = field.isMissing(a);
    const bMissing = field.isMissing(b);
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    const cmp = field.compareAsc(a, b);
    return direction === "asc" ? cmp : -cmp;
  };
}

type ViewMode = "card" | "grid";

const ALL = "__all__";

// Card view has a fixed set of always-visible fields (year read, stars), so
// sorting by anything else needs its value shown explicitly -- otherwise
// sorting by, say, publication year looks like nothing happened because only
// year read is on screen. Title is skipped since the card heading already
// is the title.
function sortValueLabel(book: Book, key: string): string | null {
  switch (key) {
    case "title":
      return null;
    case "score":
      return `Score: ${book.score != null ? book.score.toFixed(1) : "Unrated"}`;
    case "year_read":
      return `Year read: ${book.year_read ?? "Unknown"}`;
    case "page_count":
      return `Pages: ${book.page_count ?? "Unknown"}`;
    case "year_released":
      return `Published: ${book.year_released ?? "Unknown"}`;
    case "date_finished":
      return `Finished: ${book.date_finished ?? "Unknown"}`;
    case "word_count":
      return `Words: ${book.word_count != null ? Math.round(book.word_count).toLocaleString() : "Unknown"}`;
    case "author":
      return `Author: ${book.author ?? "Unknown"}`;
    case "series":
      return book.series
        ? `Series: ${book.series}${book.series_number != null ? ` #${book.series_number}` : ""}`
        : "Series: Unknown";
    case "date_started":
      return `Started: ${book.date_started ?? "Unknown"}`;
    case "days_taken": {
      const days = daysTaken(book);
      return `Days taken: ${days != null ? days : "Unknown"}`;
    }
    case "pace": {
      const pace = readingPace(book);
      return `Pace: ${pace != null ? `${pace.toFixed(1)} pg/day` : "Unknown"}`;
    }
    default:
      return null;
  }
}

export function LibraryView({
  books: initialBooks,
  allGenres,
  allSubgenres,
}: {
  books: Book[];
  allGenres: string[];
  allSubgenres: string[];
}) {
  const searchParams = useSearchParams();
  const [books, setBooks] = useState(initialBooks);
  const [genre, setGenre] = useState(ALL);
  const [format, setFormat] = useState(ALL);
  const [yearRead, setYearRead] = useState(ALL);
  const [yearPublished, setYearPublished] = useState(ALL);
  // Deep-linked from e.g. a series ranking row (/library?series=X) -- only
  // honored if it actually matches a series in this library.
  const [series, setSeries] = useState(() => {
    const param = searchParams.get("series");
    if (!param) return ALL;
    return initialBooks.some((b) => b.series === param) ? param : ALL;
  });
  const [indieOnly, setIndieOnly] = useState(false);
  const [sortFieldKey, setSortFieldKey] = useState<string>("date_finished");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
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
  // column headers -- so only Card view applies SORT_FIELDS here.
  const filtered = useMemo(() => {
    return books
      .filter((b) => genre === ALL || b.genre === genre)
      .filter((b) => format === ALL || b.format_type === format)
      .filter((b) => yearRead === ALL || String(b.year_read) === yearRead)
      .filter((b) => yearPublished === ALL || String(b.year_released) === yearPublished)
      .filter((b) => series === ALL || b.series === series)
      .filter((b) => !indieOnly || b.indie === true);
  }, [books, genre, format, yearRead, yearPublished, series, indieOnly]);

  const sortField = SORT_FIELDS.find((f) => f.key === sortFieldKey) ?? SORT_FIELDS[0];

  const cardSorted = useMemo(
    () => [...filtered].sort(compareBooks(sortField, sortDirection)),
    [filtered, sortField, sortDirection]
  );

  const filtersActive =
    genre !== ALL ||
    format !== ALL ||
    yearRead !== ALL ||
    yearPublished !== ALL ||
    series !== ALL ||
    indieOnly;

  function clearFilters() {
    setGenre(ALL);
    setFormat(ALL);
    setYearRead(ALL);
    setYearPublished(ALL);
    setSeries(ALL);
    setIndieOnly(false);
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
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className={`${fraunces.className} text-3xl font-semibold text-ink-warm sm:text-4xl`}>
              Library
            </h1>
            <p className="mt-1 text-sm text-ink-warm-faint">
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

            <div className="surface-flat flex gap-1 rounded-full p-1">
              <button
                type="button"
                onClick={() => setView("card")}
                aria-pressed={view === "card"}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  view === "card" ? "bg-accent text-on-accent" : "text-ink-warm-muted hover:text-ink-warm"
                }`}
              >
                Card
              </button>
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-pressed={view === "grid"}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  view === "grid" ? "bg-accent text-on-accent" : "text-ink-warm-muted hover:text-ink-warm"
                }`}
              >
                Grid
              </button>
            </div>
          </div>
        </header>

        <CurrentlyReadingPanel />

        <div className="surface-flat sticky top-0 z-10 -mx-4 mb-8 rounded-none px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl">
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

            <div className="flex flex-col gap-1">
              <span className={labelClass()}>Indie</span>
              <button
                type="button"
                onClick={() => setIndieOnly((v) => !v)}
                aria-pressed={indieOnly}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  indieOnly
                    ? "border-accent bg-accent/10 text-ink-warm"
                    : "border-gold bg-surface-1 text-ink-warm-muted hover:bg-surface-2"
                }`}
              >
                Indie only
              </button>
            </div>

            {view === "card" && (
              <div className="flex flex-col gap-1">
                <label className={labelClass()} htmlFor="sort-by">
                  Sort by
                </label>
                <div className="flex gap-1">
                  <select
                    id="sort-by"
                    className={selectClass()}
                    value={sortFieldKey}
                    onChange={(e) => setSortFieldKey(e.target.value)}
                  >
                    {SORT_FIELDS.map(({ key, label }) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                    className="rounded-full border border-gold bg-surface-1 px-3 py-1.5 text-sm text-ink-warm shadow-sm transition hover:bg-surface-2"
                    title="Toggle sort direction"
                  >
                    {sortDirection === "asc" ? sortField.ascLabel : sortField.descLabel}{" "}
                    <span aria-hidden>{sortDirection === "asc" ? "↑" : "↓"}</span>
                  </button>
                </div>
              </div>
            )}

            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto text-sm text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-warm-faint">
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
                sortValueLabel={sortValueLabel(book, sortFieldKey)}
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
          subgenreOptions={allSubgenres}
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
