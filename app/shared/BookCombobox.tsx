"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CoverThumb } from "./CoverThumb";
import { fieldClass } from "./formControls";
import { normalizeTitle } from "./normalizeTitle";

// The minimal shape BookCombobox itself reads (id/title/author/cover, plus
// an optional recency signal for default ordering) -- callers are free to
// carry extra fields on their own item type (genre, word_count, a tbr id
// instead of a book_id, ...) and get the whole object back on selection.
export type BookComboboxItem = {
  id: number;
  title: string;
  author: string | null;
  cover_url: string | null;
  // ISO date (YYYY-MM-DD) of the most recent activity on this item -- drives
  // the pre-typing suggestion order. Omit for item sets with no recency
  // concept (e.g. an unread TBR list); the combobox then just falls back to
  // whatever order it was given.
  last_activity?: string | null;
};

const MAX_RESULTS = 8;
// Stable reference so an unmet fetch/empty-items render doesn't hand
// useMemo a fresh [] every time (would defeat its memoization).
const EMPTY_ITEMS: never[] = [];

// Search-as-you-type picker over a list of books -- reusable across
// anywhere a book gets chosen (gateways, start-a-book, ceremony, ...).
// With no `items` prop it fetches the full read library itself from
// /api/books/picker, which is the standalone/default mode; pass `items` to
// point it at a different set instead (e.g. TBR entries, keyed by tbr id).
export function BookCombobox<T extends BookComboboxItem>({
  items,
  onSelect,
  placeholder = "Search your library...",
  autoFocus,
}: {
  items?: T[];
  onSelect: (item: T) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [fetchedItems, setFetchedItems] = useState<T[] | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const optionRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const usingOwnFetch = items === undefined;

  useEffect(() => {
    if (!usingOwnFetch || fetchedItems !== null) return;
    fetch("/api/books/picker")
      .then((res) => res.json())
      .then((data) => setFetchedItems(Array.isArray(data) ? data : []))
      .catch(() => setFetchedItems([]));
  }, [usingOwnFetch, fetchedItems]);

  const loading = usingOwnFetch && fetchedItems === null;

  const results = useMemo(() => {
    const pool = items ?? fetchedItems ?? EMPTY_ITEMS;
    const normalizedQuery = normalizeTitle(query);
    if (!normalizedQuery) {
      return [...pool]
        .sort((a, b) => (b.last_activity ?? "").localeCompare(a.last_activity ?? ""))
        .slice(0, MAX_RESULTS);
    }
    const looseQuery = query.trim().toLowerCase();
    return pool
      .filter(
        (item) =>
          normalizeTitle(item.title).includes(normalizedQuery) ||
          (item.author ?? "").toLowerCase().includes(looseQuery)
      )
      .slice(0, MAX_RESULTS);
  }, [items, fetchedItems, query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    setActiveIndex(0);
  }

  useEffect(() => {
    const active = results[activeIndex];
    if (active) optionRefs.current.get(active.id)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) onSelect(item);
    }
  }

  const activeId = results[activeIndex] ? `book-combobox-option-${results[activeIndex].id}` : undefined;

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={fieldClass()}
        role="combobox"
        aria-expanded="true"
        aria-controls="book-combobox-list"
        aria-activedescendant={activeId}
        aria-autocomplete="list"
      />
      <div
        id="book-combobox-list"
        role="listbox"
        className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-gold"
      >
        {loading ? (
          <p className="p-3 text-sm text-ink-warm-faint">Loading...</p>
        ) : results.length === 0 ? (
          <p className="p-3 text-sm text-ink-warm-faint">No matches.</p>
        ) : (
          results.map((item, i) => (
            <button
              key={item.id}
              id={`book-combobox-option-${item.id}`}
              ref={(el) => {
                if (el) optionRefs.current.set(item.id, el);
                else optionRefs.current.delete(item.id);
              }}
              type="button"
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => onSelect(item)}
              className={`flex w-full items-center gap-3 border-b border-gold px-3 py-2 text-left text-sm last:border-0 ${
                i === activeIndex ? "bg-hover" : "hover:bg-hover"
              }`}
            >
              <CoverThumb title={item.title} coverUrl={item.cover_url} className="aspect-[2/3] w-8" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink-warm">{item.title}</span>
                {item.author && <span className="block truncate text-xs text-ink-warm-faint">{item.author}</span>}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
