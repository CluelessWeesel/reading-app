"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fraunces } from "../shared/fonts";
import { labelClass, selectClass } from "../shared/formControls";
import { AuthorCard } from "./AuthorCard";
import type { AuthorSummary } from "./types";

type SortKey = "name" | "books" | "pages" | "words" | "avgScore" | "mostRecent";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name (A–Z)",
  books: "Books read (most)",
  pages: "Pages (most)",
  words: "Words (most)",
  avgScore: "Average score (highest)",
  mostRecent: "Most recently read",
};

// Missing values always sort to the end, regardless of which field is picked.
function compareAuthors(a: AuthorSummary, b: AuthorSummary, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "books":
      return b.booksCount - a.booksCount;
    case "pages":
      return b.totalPages - a.totalPages;
    case "words":
      return b.totalWords - a.totalWords;
    case "avgScore": {
      if (a.avgScore == null && b.avgScore == null) return 0;
      if (a.avgScore == null) return 1;
      if (b.avgScore == null) return -1;
      return b.avgScore - a.avgScore;
    }
    case "mostRecent": {
      if (a.mostRecentFinish == null && b.mostRecentFinish == null) return 0;
      if (a.mostRecentFinish == null) return 1;
      if (b.mostRecentFinish == null) return -1;
      return b.mostRecentFinish.localeCompare(a.mostRecentFinish);
    }
  }
}

function pillClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-xs font-medium transition ${
    active ? "bg-accent text-on-accent" : "border border-gold text-ink-warm-muted hover:bg-hover"
  }`;
}

export function AuthorsView({ authors }: { authors: AuthorSummary[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("mostRecent");
  const [minBooksOn, setMinBooksOn] = useState(false);
  const [queuedOnly, setQueuedOnly] = useState(false);
  const [ratedOnly, setRatedOnly] = useState(false);
  const [genreFilter, setGenreFilter] = useState("all");

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const a of authors) for (const g of a.genres) set.add(g);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [authors]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    return authors
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .filter((a) => !minBooksOn || a.booksCount >= 2)
      .filter((a) => !queuedOnly || a.hasQueued)
      .filter((a) => !ratedOnly || a.avgScore != null)
      .filter((a) => genreFilter === "all" || a.genres.includes(genreFilter))
      .sort((a, b) => compareAuthors(a, b, sortKey));
  }, [authors, search, sortKey, minBooksOn, queuedOnly, ratedOnly, genreFilter]);

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className={`${fraunces.className} text-3xl font-semibold text-ink-warm sm:text-4xl`}>Authors</h1>
            <p className="mt-1 text-sm text-ink-warm-faint">
              Showing {filteredSorted.length} of {authors.length} authors
            </p>
          </div>
          <Link
            href="/narrators"
            className="mt-1 shrink-0 text-sm text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
          >
            Narrators →
          </Link>
        </header>

        <div className="surface-flat sticky top-0 z-10 -mx-4 mb-8 rounded-none px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className={labelClass()} htmlFor="author-search">
                Search
              </label>
              <input
                id="author-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search authors..."
                className={selectClass()}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelClass()} htmlFor="author-sort">
                Sort by
              </label>
              <select
                id="author-sort"
                className={selectClass()}
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelClass()} htmlFor="author-genre">
                Genre
              </label>
              <select
                id="author-genre"
                className={selectClass()}
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value)}
              >
                <option value="all">All genres</option>
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMinBooksOn((v) => !v)}
              aria-pressed={minBooksOn}
              className={pillClass(minBooksOn)}
            >
              2+ books
            </button>
            <button
              type="button"
              onClick={() => setRatedOnly((v) => !v)}
              aria-pressed={ratedOnly}
              className={pillClass(ratedOnly)}
            >
              Rated
            </button>
            <button
              type="button"
              onClick={() => setQueuedOnly((v) => !v)}
              aria-pressed={queuedOnly}
              className={pillClass(queuedOnly)}
            >
              On TBR
            </button>
          </div>
        </div>

        {filteredSorted.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-warm-faint">No authors match this search.</p>
        ) : (
          <div className="grid grid-cols-3 gap-x-2 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {filteredSorted.map((author) => (
              <AuthorCard key={author.id} author={author} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
