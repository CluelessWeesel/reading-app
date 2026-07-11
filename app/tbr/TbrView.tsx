"use client";

import { useEffect, useMemo, useState } from "react";
import { Cover } from "../shared/Cover";
import { CurrentlyReadingPanel } from "../shared/CurrentlyReadingPanel";
import { fraunces } from "../shared/fonts";
import { selectClass, labelClass } from "../shared/formControls";
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

const ALL = "__all__";

export function TbrView({
  entries: initialEntries,
  allGenres,
}: {
  entries: TbrEntry[];
  allGenres: string[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState(ALL);
  const [ownedFormat, setOwnedFormat] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [modalTarget, setModalTarget] = useState<TbrEntry | "new" | null>(null);
  const [startBookTarget, setStartBookTarget] = useState<TbrEntry | "generic" | null>(null);

  const genresInUse = useMemo(
    () => Array.from(new Set(entries.filter((e) => e.genre).map((e) => e.genre as string))).sort(),
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
      .filter((e) => genre === ALL || e.genre === genre)
      .filter((e) => ownedFormat === ALL || e.owned_or_format === ownedFormat)
      .sort(SORTS[sortKey].compare);
  }, [entries, search, genre, ownedFormat, sortKey]);

  const filtersActive = search.trim() !== "" || genre !== ALL || ownedFormat !== ALL;

  function clearFilters() {
    setSearch("");
    setGenre(ALL);
    setOwnedFormat(ALL);
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
              Showing {filtered.length} of {entries.length} entries
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
          </div>
        </header>

        <CurrentlyReadingPanel />

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
              <label className={labelClass()} htmlFor="tbr-filter-genre">
                Genre
              </label>
              <select
                id="tbr-filter-genre"
                className={selectClass()}
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
              >
                <option value={ALL}>All genres</option>
                {genresInUse.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelClass()} htmlFor="tbr-filter-owned">
                Owned / format
              </label>
              <select
                id="tbr-filter-owned"
                className={selectClass()}
                value={ownedFormat}
                onChange={(e) => setOwnedFormat(e.target.value)}
              >
                <option value={ALL}>All</option>
                {ownedFormatOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
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
        ) : (
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
