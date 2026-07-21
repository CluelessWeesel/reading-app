"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuthorPhoto } from "../../authors/AuthorPhoto";
import { rankColor } from "../../books/[id]/rankColor";
import { fraunces } from "../../shared/fonts";
import { FORMAT_LABELS } from "../../shared/formatLabels";
import { computeAuthorCrowns, computeAuthorNominations } from "../weeselMath";
import type { CrownEntry } from "../types";
import type { WeeselCategory, WeeselRow } from "../types";

const PAGE_SIZE = 10;
const FORMATS = ["physical", "ebook", "audio"];

function pillClass(active: boolean): string {
  return `rounded-full px-3 py-1.5 text-xs font-medium transition ${
    active ? "bg-accent text-on-accent" : "border border-gold text-ink-warm-muted hover:bg-hover"
  }`;
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-warm-faint">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

// One ranked table (Wins or Nominations) -- each keeps its own expand state
// so opening one doesn't force the other open too.
function AuthorRankedTable({
  title,
  entries,
  photos,
  narratorPhotos,
}: {
  title: string;
  entries: CrownEntry[];
  photos: Record<number, string | null>;
  narratorPhotos: Record<number, string | null>;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? entries : entries.slice(0, PAGE_SIZE);

  return (
    <div className="rounded-xl border border-gold bg-surface-1 p-4">
      <h2 className={`${fraunces.className} mb-3 text-base font-semibold text-ink-warm`}>{title}</h2>
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-warm-faint">No {title.toLowerCase()} match these filters.</p>
      ) : (
        <>
          <ul className="divide-y divide-gold">
            {shown.map((e, i) => {
              const { background, color } = rankColor(i + 1, entries.length);
              // Best Narration entries carry a narratorId instead of an
              // authorId (see weeselMath.ts's creditedNarratorId) -- checked
              // first so a narrator's row links to their own page.
              const href = e.narratorId != null ? `/narrators/${e.narratorId}` : e.authorId != null ? `/authors/${e.authorId}` : null;
              const photoUrl = e.narratorId != null ? (narratorPhotos[e.narratorId] ?? null) : e.authorId != null ? (photos[e.authorId] ?? null) : null;
              return (
                <li key={e.authorId ?? e.narratorId ?? `${e.label}-${i}`} className="flex items-center gap-3 py-2">
                  <span
                    className="flex w-7 shrink-0 items-center justify-center rounded-full py-0.5 text-xs font-medium"
                    style={{ background, color }}
                  >
                    {i + 1}
                  </span>
                  <AuthorPhoto
                    name={e.label}
                    photoUrl={photoUrl}
                    className="aspect-square w-8 shrink-0"
                    initialClassName="text-xs"
                  />
                  {href != null ? (
                    <Link href={href} className="min-w-0 flex-1 truncate text-sm text-ink-warm hover:underline">
                      {e.label}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-warm">{e.label}</span>
                  )}
                  <span className="shrink-0 text-sm font-semibold text-ink-warm">{e.count}</span>
                </li>
              );
            })}
          </ul>
          {entries.length > PAGE_SIZE && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
            >
              {expanded ? "Show top 10" : `Show all ${entries.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function AuthorWinsBoard({
  rows,
  categories,
  photos,
  narratorPhotos,
}: {
  rows: WeeselRow[];
  categories: WeeselCategory[];
  photos: Record<number, string | null>;
  narratorPhotos: Record<number, string | null>;
}) {
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const years = useMemo(() => Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => a - b), [rows]);
  const genres = useMemo(
    () => Array.from(new Set(rows.map((r) => r.book_genre).filter((g): g is string => g != null))).sort(),
    [rows]
  );

  const [yearFilter, setYearFilter] = useState<"all" | number>("all");
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<number>>(() => new Set(categories.map((c) => c.id)));
  const [activeGenres, setActiveGenres] = useState<Set<string>>(() => new Set(genres));
  const [activeFormats, setActiveFormats] = useState<Set<string>>(() => new Set(FORMATS));

  const filteredRows = useMemo(() => {
    // Genre/format only meaningfully exist for book-linked categories --
    // narrowing either filter away from "everything selected" excludes rows
    // with no book (Author of the Year, etc.), but the default, nothing-
    // deliberately-filtered state must still count every win/nom regardless
    // of whether it has a genre/format to check against.
    const genresNarrowed = activeGenres.size < genres.length;
    const formatsNarrowed = activeFormats.size < FORMATS.length;
    return rows.filter((r) => {
      if (yearFilter !== "all" && r.year !== yearFilter) return false;
      if (r.category_id == null || !activeCategoryIds.has(r.category_id)) return false;
      if (genresNarrowed && (r.book_genre == null || !activeGenres.has(r.book_genre))) return false;
      if (formatsNarrowed && (r.book_format_type == null || !activeFormats.has(r.book_format_type))) return false;
      return true;
    });
  }, [rows, yearFilter, activeCategoryIds, activeGenres, activeFormats, genres.length]);

  const winEntries = useMemo(() => computeAuthorCrowns(filteredRows, categoriesById), [filteredRows, categoriesById]);
  const nomEntries = useMemo(
    () => computeAuthorNominations(filteredRows, categoriesById),
    [filteredRows, categoriesById]
  );

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <Link href="/weesels" className="mb-2 inline-block text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm">
            &larr; Back to Weesels
          </Link>
          <h1 className={`${fraunces.className} text-3xl font-semibold text-ink-warm`}>Author wins &amp; nominations</h1>
        </header>

        <FilterGroup label="Year">
          <button type="button" onClick={() => setYearFilter("all")} className={pillClass(yearFilter === "all")}>
            All-time
          </button>
          {years.map((y) => (
            <button key={y} type="button" onClick={() => setYearFilter(y)} className={pillClass(yearFilter === y)}>
              {y}
            </button>
          ))}
        </FilterGroup>

        <FilterGroup label="Category">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategoryIds((prev) => toggle(prev, c.id))}
              className={pillClass(activeCategoryIds.has(c.id))}
            >
              {c.name}
            </button>
          ))}
        </FilterGroup>

        <FilterGroup label="Genre">
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setActiveGenres((prev) => toggle(prev, g))}
              className={pillClass(activeGenres.has(g))}
            >
              {g}
            </button>
          ))}
        </FilterGroup>

        <FilterGroup label="Format">
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFormats((prev) => toggle(prev, f))}
              className={pillClass(activeFormats.has(f))}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </FilterGroup>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <AuthorRankedTable title="Wins" entries={winEntries} photos={photos} narratorPhotos={narratorPhotos} />
          <AuthorRankedTable title="Nominations" entries={nomEntries} photos={photos} narratorPhotos={narratorPhotos} />
        </div>
      </div>
    </div>
  );
}
