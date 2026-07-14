"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import { CollapsibleCard, CoverThumb, EmptyState } from "./DistributionShared";
import type { Bucket } from "./distributionMath";

export type Marker = { label: string; position: number };

// The one reusable chart behind most /stats distribution cards: a bar chart
// (vertical histogram or horizontal split) where hovering a bar previews it
// and clicking pins open a full drill-down book list beneath. New
// distributions are just a bucket-building function (distributionMath.ts)
// plus a thin wrapper around this component -- see DistributionsSection.tsx.
export function DistributionCard({
  title,
  buckets,
  orientation,
  valueOf,
  formatValue,
  drillValue,
  markers,
  caption,
  toggle,
  excludedNote,
  minBooksForChart = 3,
  emptyMessage = "Not enough books in scope yet.",
}: {
  title: string;
  buckets: Bucket[];
  orientation: "vertical" | "horizontal";
  valueOf: (b: Bucket) => number;
  formatValue: (value: number, bucket: Bucket) => string;
  drillValue?: (book: Bucket["books"][number]) => string | null;
  markers?: Marker[];
  // Summary text (e.g. "Mean 3.72 · Median 3.75 · Mode 3.5") shown below the
  // chart -- markers draw the lines, this spells out what they mean since
  // stacking floating per-marker labels collides too easily when they're close.
  caption?: string | null;
  toggle?: ReactNode;
  excludedNote?: string | null;
  minBooksForChart?: number;
  emptyMessage?: string;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const totalBooks = buckets.reduce((sum, b) => sum + b.books.length, 0);

  if (totalBooks < minBooksForChart) {
    return (
      <CollapsibleCard title={title} toggle={toggle} excludedNote={excludedNote}>
        <EmptyState message={emptyMessage} />
      </CollapsibleCard>
    );
  }

  const values = buckets.map(valueOf);
  const maxValue = Math.max(...values, 1);
  const hovered = buckets.find((b) => b.key === hoveredKey) ?? null;
  const selected = buckets.find((b) => b.key === selectedKey) ?? null;

  function toggleSelected(key: string) {
    setSelectedKey((prev) => (prev === key ? null : key));
  }

  return (
    <CollapsibleCard title={title} toggle={toggle} excludedNote={excludedNote}>
      {orientation === "vertical" ? (
        <div>
          <div className="relative">
            <div className="flex h-36 items-end gap-1">
              {buckets.map((b) => {
                const v = valueOf(b);
                const active = selectedKey === b.key;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => toggleSelected(b.key)}
                    onMouseEnter={() => setHoveredKey(b.key)}
                    onMouseLeave={() => setHoveredKey((k) => (k === b.key ? null : k))}
                    aria-pressed={active}
                    aria-label={`${b.label}: ${formatValue(v, b)}`}
                    className={`flex-1 rounded-t transition ${active ? "bg-accent" : "bg-accent/45 hover:bg-accent/70"}`}
                    style={{ height: `${Math.max((v / maxValue) * 100, v > 0 ? 3 : 1)}%` }}
                  />
                );
              })}
            </div>

            {markers?.map((m) => {
              const pct = buckets.length > 1 ? (m.position / (buckets.length - 1)) * 100 : 50;
              return (
                <div
                  key={m.label}
                  title={m.label}
                  className="absolute bottom-0 top-0 border-l border-dashed border-ink-faint/70"
                  style={{ left: `${Math.min(Math.max(pct, 0), 100)}%` }}
                />
              );
            })}
          </div>
          <div className="mt-1 flex gap-1">
            {buckets.map((b) => (
              <span key={b.key} className="flex-1 truncate text-center text-[9px] text-ink-faint">
                {b.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {buckets.map((b) => {
            const v = valueOf(b);
            const active = selectedKey === b.key;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => toggleSelected(b.key)}
                onMouseEnter={() => setHoveredKey(b.key)}
                onMouseLeave={() => setHoveredKey((k) => (k === b.key ? null : k))}
                aria-pressed={active}
                className="flex w-full items-center gap-2 text-left text-xs"
              >
                <span className="w-28 shrink-0 truncate text-ink-faint">{b.label}</span>
                <span className="h-4 flex-1 overflow-hidden rounded bg-hairline">
                  <span
                    className={`block h-full rounded transition ${active ? "bg-accent" : "bg-accent/55"}`}
                    style={{ width: `${Math.max((v / maxValue) * 100, v > 0 ? 2 : 0)}%` }}
                  />
                </span>
                <span className="w-20 shrink-0 text-right text-ink">{formatValue(v, b)}</span>
              </button>
            );
          })}
        </div>
      )}

      {caption && <p className="mt-1.5 text-xs text-ink-faint">{caption}</p>}

      {hovered && !selected && (
        <p className="mt-2 truncate text-xs text-ink-faint">
          <span className="text-ink">{hovered.label}</span>: {formatValue(valueOf(hovered), hovered)}
          {hovered.books.length > 0 &&
            ` — ${hovered.books
              .slice(0, 3)
              .map((bk) => bk.title)
              .join(", ")}${hovered.books.length > 3 ? "..." : ""}`}
        </p>
      )}

      {selected && (
        <div className="mt-3 border-t border-hairline pt-3">
          <p className="mb-2 text-xs font-medium text-ink">
            {selected.label} · {selected.books.length} book{selected.books.length === 1 ? "" : "s"}
          </p>
          {selected.books.length === 0 ? (
            <p className="text-xs text-ink-faint">No books in this range.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {selected.books.map((book) => (
                <li key={book.book_id} className="flex items-center gap-2">
                  <CoverThumb title={book.title} coverUrl={book.cover_url} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/books/${book.book_id}`} className="block truncate text-sm text-ink hover:underline">
                      {book.title}
                    </Link>
                    <p className="truncate text-xs text-ink-faint">{book.author}</p>
                  </div>
                  {drillValue && (
                    <span className="shrink-0 text-xs text-ink-faint">{drillValue(book)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </CollapsibleCard>
  );
}
