"use client";

import { useEffect, useMemo, useState } from "react";
import { Cover } from "../shared/Cover";
import { CurrentlyReadingPanel } from "../shared/CurrentlyReadingPanel";
import { fraunces } from "../shared/fonts";
import { selectClass, labelClass } from "../shared/formControls";
import { formatCompactNumber } from "../shared/formatCompactNumber";
import { formatExactUtc, formatRelativeTime } from "../shared/relativeTime";
import { StartBookModal } from "../shared/StartBookModal";
import { titleSortKey } from "../shared/titleSortKey";
import { TbrEntryModal } from "./TbrEntryModal";
import type { TbrEntry } from "./types";

// Relative time ("3 minutes ago") depends on Date.now() at render time, which
// differs between the server-render pass and the client hydration pass --
// exactly the kind of thing that causes a hydration mismatch. Rendering
// nothing until after mount keeps the server/client hydration pass
// identical; the real text fills in a moment later as a normal client-side
// update, not a mismatch.
function LastAddedLabel({ iso }: { iso: string }) {
  const [mounted, setMounted] = useState(false);
  // The standard client-only-render idiom: this *is* the mismatch fix, not
  // an anti-pattern the lint rule usually warns against.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <p className="text-sm text-ink-faint" title={formatExactUtc(iso)}>
      Last added {formatRelativeTime(iso)}
    </p>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.04A8.97 8.97 0 0 0 6 3.75c-1.05 0-2.06.18-3 .51v14.25A8.99 8.99 0 0 1 6 18c2.3 0 4.41.87 6 2.29m0-14.25a8.97 8.97 0 0 1 6-2.29c1.05 0 2.06.18 3 .51v14.25A8.99 8.99 0 0 0 18 18a8.97 8.97 0 0 0-6 2.29m0-14.25v14.25"
      />
    </svg>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 3h1.39c.51 0 .95.34 1.09.84l.38 1.44M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.22c1.12-2.3 2.1-4.68 2.92-7.14a60 60 0 0 0-16.54-1.84M7.5 14.25 5.11 5.27M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
      />
    </svg>
  );
}

const SORTS = {
  title: {
    label: "Title (A–Z)",
    compare: (a: TbrEntry, b: TbrEntry) => titleSortKey(a.title).localeCompare(titleSortKey(b.title)),
  },
  word_count: {
    label: "Word count (highest)",
    compare: (a: TbrEntry, b: TbrEntry) => (b.word_count ?? -1) - (a.word_count ?? -1),
  },
} as const;

type SortKey = keyof typeof SORTS;
type Shelf = "owned" | "unowned" | "unsorted";
type Layout = "list" | "card";

export function TbrView({
  entries: initialEntries,
  allGenres,
}: {
  entries: TbrEntry[];
  allGenres: string[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [search, setSearch] = useState("");
  const [shelf, setShelf] = useState<Shelf>("owned");
  const [layout, setLayout] = useState<Layout>("list");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [modalTarget, setModalTarget] = useState<TbrEntry | "new" | null>(null);
  const [startBookTarget, setStartBookTarget] = useState<TbrEntry | "generic" | null>(null);

  const ownedCount = useMemo(() => entries.filter((e) => e.owned === true).length, [entries]);
  const unownedCount = useMemo(() => entries.filter((e) => e.owned === false).length, [entries]);
  const unsortedCount = useMemo(() => entries.filter((e) => e.owned == null).length, [entries]);

  const totalWords = useMemo(
    () => entries.reduce((sum, e) => sum + (e.word_count ?? 0), 0),
    [entries]
  );
  const totalWordsOwned = useMemo(
    () => entries.filter((e) => e.owned === true).reduce((sum, e) => sum + (e.word_count ?? 0), 0),
    [entries]
  );
  const totalWordsUnowned = useMemo(
    () => entries.filter((e) => e.owned === false).reduce((sum, e) => sum + (e.word_count ?? 0), 0),
    [entries]
  );
  const totalWordsUnsorted = useMemo(
    () => entries.filter((e) => e.owned == null).reduce((sum, e) => sum + (e.word_count ?? 0), 0),
    [entries]
  );

  const ownedFormatOptions = useMemo(
    () =>
      Array.from(
        new Set(entries.filter((e) => e.owned_or_format).map((e) => e.owned_or_format as string))
      ).sort(),
    [entries]
  );

  // created_at is only ever set on insert (never touched by an edit), so the
  // most recent one across all entries is exactly "when did I last add a
  // new book" -- not "when did I last edit one".
  const lastAdded = useMemo(
    () =>
      entries.length === 0
        ? null
        : entries.reduce((latest, e) => (e.created_at > latest ? e.created_at : latest), entries[0].created_at),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter(
        (e) =>
          !q ||
          e.title.toLowerCase().includes(q) ||
          (e.author && e.author.toLowerCase().includes(q))
      )
      .filter((e) => {
        if (shelf === "owned") return e.owned === true;
        if (shelf === "unowned") return e.owned === false;
        return e.owned == null;
      })
      .sort(SORTS[sortKey].compare);
  }, [entries, search, shelf, sortKey]);

  const filtersActive = search.trim() !== "";

  function clearFilters() {
    setSearch("");
  }

  function handleSaved(entry: TbrEntry) {
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === entry.id);
      return exists ? prev.map((e) => (e.id === entry.id ? entry : e)) : [...prev, entry];
    });
    setModalTarget(null);
  }

  function handleDeleted(id: number) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setModalTarget(null);
  }

  function handleCoverChange(id: number, coverUrl: string | null) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, cover_url: coverUrl } : e)));
  }

  function handleTbrConsumed(id: number) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="min-h-full flex-1 bg-paper px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className={`${fraunces.className} text-3xl font-semibold text-ink sm:text-4xl`}>
              To Be Read
            </h1>
            <p className="mt-1 text-sm text-ink-faint">
              {entries.length} book{entries.length === 1 ? "" : "s"} ·{" "}
              {formatCompactNumber(totalWords)} words
            </p>
            <p className="text-xs text-ink-faint">
              {formatCompactNumber(totalWordsOwned)} owned · {formatCompactNumber(totalWordsUnowned)} unowned
              {unsortedCount > 0 && ` · ${formatCompactNumber(totalWordsUnsorted)} unsorted`}
            </p>
            {lastAdded && <LastAddedLabel iso={lastAdded} />}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStartBookTarget("generic")}
              className="rounded-full bg-accent px-4 py-1.5 text-sm text-on-accent shadow-sm transition hover:brightness-95"
            >
              Start a book
            </button>
            <button
              type="button"
              onClick={() => setModalTarget("new")}
              className="rounded-full border border-hairline bg-card/70 px-4 py-1.5 text-sm text-ink shadow-sm transition hover:bg-hover"
            >
              + Add entry
            </button>

            <div className="flex gap-1 rounded-full border border-hairline bg-card/70 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setLayout("list")}
                aria-pressed={layout === "list"}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  layout === "list" ? "bg-accent text-on-accent" : "text-ink-muted hover:text-ink"
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setLayout("card")}
                aria-pressed={layout === "card"}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  layout === "card" ? "bg-accent text-on-accent" : "text-ink-muted hover:text-ink"
                }`}
              >
                Cards
              </button>
            </div>
          </div>
        </header>

        <CurrentlyReadingPanel />

        <div className="mb-2 flex gap-3">
          <button
            type="button"
            onClick={() => setShelf("owned")}
            aria-pressed={shelf === "owned"}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              shelf === "owned"
                ? "border-accent bg-accent text-on-accent shadow-sm"
                : "border-hairline bg-card/70 text-ink-muted hover:bg-hover"
            }`}
          >
            <BookIcon className="h-5 w-5" />
            Owned · {ownedCount}
          </button>
          <button
            type="button"
            onClick={() => setShelf("unowned")}
            aria-pressed={shelf === "unowned"}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              shelf === "unowned"
                ? "border-accent bg-accent text-on-accent shadow-sm"
                : "border-hairline bg-card/70 text-ink-muted hover:bg-hover"
            }`}
          >
            <CartIcon className="h-5 w-5" />
            Unowned · {unownedCount}
          </button>
        </div>

        {unsortedCount > 0 && (
          <button
            type="button"
            onClick={() => setShelf("unsorted")}
            className={`mb-6 block text-xs underline decoration-dotted underline-offset-4 ${
              shelf === "unsorted" ? "text-ink" : "text-ink-faint hover:text-ink"
            }`}
          >
            {unsortedCount} unsorted
          </button>
        )}

        <div className="sticky top-0 z-10 -mx-4 mb-8 border-b border-hairline bg-paper/90 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className={labelClass()} htmlFor="tbr-search">
                Search
              </label>
              <input
                id="tbr-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or author..."
                className={selectClass()}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelClass()} htmlFor="tbr-sort-by">
                Sort by
              </label>
              <select
                id="tbr-sort-by"
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
            No TBR entries match these filters.
          </p>
        ) : layout === "list" ? (
          <ul className="divide-y divide-hairline">
            {filtered.map((entry) => (
              <li key={entry.id} className="flex items-center gap-4 py-3">
                <Cover
                  id={entry.id}
                  title={entry.title}
                  coverUrl={entry.cover_url}
                  onCoverChange={handleCoverChange}
                  apiPath={`/api/tbr/${entry.id}/cover`}
                  className="aspect-[2/3] w-8"
                  initialClassName="text-xs"
                />
                <div className="min-w-0 flex-1">
                  <h2 className={`${fraunces.className} truncate text-base font-semibold text-ink`}>
                    {entry.title}
                  </h2>
                  <p className="truncate text-xs text-ink-muted">{entry.author ?? "Unknown author"}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {entry.genre ?? "No genre"}
                    {entry.subgenre ? ` · ${entry.subgenre}` : ""}
                    {entry.owned_or_format ? ` · ${entry.owned_or_format}` : ""}
                  </p>
                </div>
                {entry.owned != null && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      entry.owned ? "bg-accent/10 text-accent" : "text-ink-faint"
                    }`}
                  >
                    {entry.owned ? "Owned" : "Unowned"}
                  </span>
                )}
                <div className="shrink-0 text-right text-xs text-ink-faint">
                  {entry.word_count != null ? `${entry.word_count.toLocaleString()} words` : "--"}
                </div>
                <button
                  type="button"
                  onClick={() => setStartBookTarget(entry)}
                  className="shrink-0 text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={() => setModalTarget(entry)}
                  className="shrink-0 text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((entry) => (
              // A plain div, not a button -- Cover renders its own <button>
              // internally (the cover-edit pencil overlay), and a <button>
              // can't contain a nested <button> without a hydration error.
              <div
                key={entry.id}
                className="group flex flex-col gap-2 rounded-xl p-2 transition hover:-translate-y-0.5 hover:bg-hover"
              >
                <Cover
                  id={entry.id}
                  title={entry.title}
                  coverUrl={entry.cover_url}
                  onCoverChange={handleCoverChange}
                  apiPath={`/api/tbr/${entry.id}/cover`}
                  roundedClassName="rounded-xl"
                />
                {/* Fixed-height text block (not per-line min-height guesses)
                    so every card's bottom edge lands at the same offset
                    regardless of title/author length -- same fix as the
                    library card grid's title-wrap alignment issue. */}
                <div className="flex h-20 flex-col gap-0.5 px-0.5">
                  <h2 className={`${fraunces.className} line-clamp-2 text-sm font-semibold leading-snug text-ink`}>
                    {entry.title}
                  </h2>
                  <p className="truncate text-xs text-ink-muted">{entry.author ?? "Unknown author"}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {entry.word_count != null ? `${entry.word_count.toLocaleString()} words` : "--"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setModalTarget(entry)}
                  className="self-start px-0.5 text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalTarget && (
        <TbrEntryModal
          entry={modalTarget === "new" ? null : modalTarget}
          allGenres={allGenres}
          ownedFormatOptions={ownedFormatOptions}
          onClose={() => setModalTarget(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {startBookTarget && (
        <StartBookModal
          initialTbrEntry={startBookTarget === "generic" ? null : startBookTarget}
          onClose={() => setStartBookTarget(null)}
          onStarted={() => setStartBookTarget(null)}
          onTbrEntryConsumed={handleTbrConsumed}
        />
      )}
    </div>
  );
}
