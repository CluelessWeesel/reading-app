"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Cover } from "../shared/Cover";
import { fraunces } from "../shared/fonts";
import { FORMAT_LABELS } from "../shared/formatLabels";
import { titleSortKey } from "../shared/titleSortKey";
import { formatDateShort } from "../shared/formatDateShort";
import type { Book } from "../shared/bookTypes";

type EnrichedBook = Book & {
  wordsPerPage: number | null;
  readingDays: number | null;
  pagesPerDay: number | null;
  wordsPerDay: number | null;
};

// Reading-pace metrics only resolve once a book has both a start and finish
// date. date_started is currently NULL for every book (Goodreads' export
// doesn't have it either -- see scripts/backfill-goodreads.ts), so these
// columns show "--" until it's backfilled by hand.
function enrich(book: Book): EnrichedBook {
  const wordsPerPage =
    book.word_count != null && book.page_count != null && book.page_count > 0
      ? book.word_count / book.page_count
      : null;

  let readingDays: number | null = null;
  if (book.date_started && book.date_finished) {
    const start = new Date(book.date_started).getTime();
    const end = new Date(book.date_finished).getTime();
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
    readingDays = days > 0 ? days : null;
  }

  const pagesPerDay = readingDays && book.page_count != null ? book.page_count / readingDays : null;
  const wordsPerDay = readingDays && book.word_count != null ? book.word_count / readingDays : null;

  return { ...book, wordsPerPage, readingDays, pagesPerDay, wordsPerDay };
}

type ColumnKey =
  | "title"
  | "author"
  | "series"
  | "genre"
  | "format_type"
  | "year_read"
  | "year_released"
  | "score"
  | "page_count"
  | "word_count"
  | "date_finished"
  | "wordsPerPage"
  | "readingDays"
  | "pagesPerDay"
  | "wordsPerDay";

type Column = {
  key: ColumnKey;
  label: string;
  align?: "right";
  // Truncatable text columns get a max width + a native title tooltip so a
  // long value doesn't force the whole table to scroll wider; numeric
  // columns are short and fixed-width so they don't need one.
  maxWidthClass?: string;
  getValue: (b: EnrichedBook) => string;
  compare: (a: EnrichedBook, b: EnrichedBook) => number;
};

function numCompare(getter: (b: EnrichedBook) => number | null) {
  return (a: EnrichedBook, b: EnrichedBook) => {
    const av = getter(a);
    const bv = getter(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return av - bv;
  };
}

function dateCompare(getter: (b: EnrichedBook) => string | null) {
  return (a: EnrichedBook, b: EnrichedBook) => {
    const av = getter(a);
    const bv = getter(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return av.localeCompare(bv);
  };
}

function fmtNum(n: number | null, digits = 0): string {
  return n == null ? "--" : n.toFixed(digits);
}

const COLUMNS: Column[] = [
  {
    key: "title",
    label: "Title",
    maxWidthClass: "max-w-[160px]",
    getValue: (b) => b.title,
    compare: (a, b) => titleSortKey(a.title).localeCompare(titleSortKey(b.title)),
  },
  {
    key: "author",
    label: "Author",
    maxWidthClass: "max-w-[130px]",
    getValue: (b) => b.author ?? "--",
    compare: (a, b) => (a.author ?? "").localeCompare(b.author ?? ""),
  },
  {
    key: "series",
    label: "Series",
    maxWidthClass: "max-w-[140px]",
    getValue: (b) => (b.series ? `${b.series}${b.series_number != null ? ` #${b.series_number}` : ""}` : "--"),
    compare: (a, b) => (a.series ?? "").localeCompare(b.series ?? ""),
  },
  {
    key: "genre",
    label: "Genre",
    maxWidthClass: "max-w-[100px]",
    getValue: (b) => b.genre ?? "--",
    compare: (a, b) => (a.genre ?? "").localeCompare(b.genre ?? ""),
  },
  {
    key: "format_type",
    label: "Format",
    maxWidthClass: "max-w-[90px]",
    getValue: (b) => (b.format_type ? FORMAT_LABELS[b.format_type] ?? b.format_type : "--"),
    compare: (a, b) => (a.format_type ?? "").localeCompare(b.format_type ?? ""),
  },
  {
    key: "year_read",
    label: "Year Read",
    align: "right",
    getValue: (b) => (b.year_read != null ? String(b.year_read) : "--"),
    compare: numCompare((b) => b.year_read),
  },
  {
    key: "year_released",
    label: "Year Pub.",
    align: "right",
    getValue: (b) => (b.year_released != null ? String(b.year_released) : "--"),
    compare: numCompare((b) => b.year_released),
  },
  {
    key: "score",
    label: "Score",
    align: "right",
    getValue: (b) => (b.score != null ? b.score.toFixed(1) : "--"),
    compare: numCompare((b) => b.score),
  },
  {
    key: "page_count",
    label: "Pages",
    align: "right",
    getValue: (b) => (b.page_count != null ? String(b.page_count) : "--"),
    compare: numCompare((b) => b.page_count),
  },
  {
    key: "word_count",
    label: "Words",
    align: "right",
    getValue: (b) => (b.word_count != null ? Math.round(b.word_count).toLocaleString() : "--"),
    compare: numCompare((b) => b.word_count),
  },
  {
    key: "date_finished",
    label: "Finished",
    align: "right",
    getValue: (b) => (b.date_finished ? formatDateShort(b.date_finished) : "--"),
    compare: dateCompare((b) => b.date_finished),
  },
  {
    key: "wordsPerPage",
    label: "Words/Page",
    align: "right",
    getValue: (b) => fmtNum(b.wordsPerPage, 0),
    compare: numCompare((b) => b.wordsPerPage),
  },
  {
    key: "readingDays",
    label: "Days",
    align: "right",
    getValue: (b) => fmtNum(b.readingDays, 0),
    compare: numCompare((b) => b.readingDays),
  },
  {
    key: "pagesPerDay",
    label: "Pages/Day",
    align: "right",
    getValue: (b) => fmtNum(b.pagesPerDay, 1),
    compare: numCompare((b) => b.pagesPerDay),
  },
  {
    key: "wordsPerDay",
    label: "Words/Day",
    align: "right",
    getValue: (b) => fmtNum(b.wordsPerDay, 0),
    compare: numCompare((b) => b.wordsPerDay),
  },
];

const ALL_COLUMN_KEYS = COLUMNS.map((c) => c.key);

type SortState = { key: ColumnKey; direction: "asc" | "desc" } | null;

export function BookTable({
  books,
  onCoverChange,
  onEditRequest,
}: {
  books: Book[];
  onCoverChange: (bookId: number, coverUrl: string | null) => void;
  onEditRequest: (bookId: number) => void;
}) {
  const [sort, setSort] = useState<SortState>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(ALL_COLUMN_KEYS)
  );

  const enriched = useMemo(() => books.map(enrich), [books]);

  const rows = useMemo(() => {
    if (!sort) return enriched;
    const column = COLUMNS.find((c) => c.key === sort.key);
    if (!column) return enriched;
    const sorted = [...enriched].sort(column.compare);
    return sort.direction === "asc" ? sorted : sorted.reverse();
  }, [enriched, sort]);

  const shownColumns = COLUMNS.filter((c) => visibleColumns.has(c.key));

  // Tri-state: click an unsorted column -> ascending, click again -> descending,
  // click a third time -> cancel (back to the unsorted/title order).
  function handleHeaderClick(key: ColumnKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // always keep at least one column
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div>
      <details className="group/cols mb-3 inline-block">
        <summary className="cursor-pointer list-none rounded-full border border-gold bg-surface-1 px-3 py-1.5 text-sm text-ink-warm shadow-sm">
          Columns ({visibleColumns.size}/{ALL_COLUMN_KEYS.length})
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-gold bg-surface-1 p-3 shadow-md sm:grid-cols-3 md:grid-cols-4">
          {COLUMNS.map((col) => (
            <label key={col.key} className="flex items-center gap-2 text-sm text-ink-warm">
              <input
                type="checkbox"
                checked={visibleColumns.has(col.key)}
                onChange={() => toggleColumn(col.key)}
                className="accent-accent"
              />
              {col.label}
            </label>
          ))}
        </div>
      </details>

      <div className="overflow-x-auto rounded-xl border border-gold bg-surface-1">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gold bg-surface-1">
              <th scope="col" className="px-2 py-1.5">
                <span className="sr-only">Cover</span>
              </th>
              <th scope="col" className="px-2 py-1.5">
                <span className="sr-only">Edit</span>
              </th>
              {shownColumns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`whitespace-nowrap px-2 py-1.5 font-medium text-ink-warm-muted ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleHeaderClick(col.key)}
                      className={`inline-flex items-center gap-1 transition hover:text-ink-warm ${active ? "text-ink-warm" : ""}`}
                    >
                      {col.label}
                      {active && <span aria-hidden>{sort!.direction === "asc" ? "▲" : "▼"}</span>}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((book) => (
              <tr key={book.book_id} className="border-b border-gold last:border-0 hover:bg-hover">
                <td className="px-2 py-1.5">
                  <Cover
                    id={book.book_id}
                    title={book.title}
                    coverUrl={book.cover_url}
                    onCoverChange={onCoverChange}
                    apiPath={`/api/books/${book.book_id}/cover`}
                    className="aspect-[2/3] w-8"
                    initialClassName="text-xs"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => onEditRequest(book.book_id)}
                    className="whitespace-nowrap text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
                  >
                    Edit
                  </button>
                </td>
                {shownColumns.map((col) => {
                  const value = col.getValue(book);
                  return (
                    <td
                      key={col.key}
                      title={col.maxWidthClass ? value : undefined}
                      className={`px-2 py-1.5 text-ink-warm ${
                        col.maxWidthClass ? `${col.maxWidthClass} truncate` : "whitespace-nowrap"
                      } ${col.align === "right" ? "text-right tabular-nums" : "text-left"} ${
                        sort?.key === col.key ? "bg-accent/10 font-medium" : ""
                      } ${col.key === "title" ? `${fraunces.className} font-semibold` : ""}`}
                    >
                      {col.key === "title" ? (
                        <Link href={`/books/${book.book_id}`} className="hover:underline">
                          {value}
                        </Link>
                      ) : col.key === "author" && book.author_id != null ? (
                        <Link href={`/authors/${book.author_id}`} className="hover:underline">
                          {value}
                        </Link>
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
