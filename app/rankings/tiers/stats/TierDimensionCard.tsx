"use client";

import Link from "next/link";
import { useState } from "react";
import { CollapsibleCard, CoverThumb, EmptyState } from "@/app/stats/DistributionShared";
import { tierLabel } from "../tierColors";
import type { TierGroup } from "./dimensionMath";

// Generic horizontal-bar + click-to-drill card, the tier-stats equivalent
// of /stats' DistributionCard -- reused for both "tier by dimension"
// (avgTierOrdinal, Section 3) and "size and shape" (pages/days/pace,
// Section 4) by taking valueOf/formatValue rather than being hardcoded to
// one metric.
export function TierDimensionCard({
  title,
  description,
  subtitle,
  groups,
  valueOf,
  formatValue,
  maxValue,
  showSBadge = false,
  emptyMessage = "Not enough books yet.",
}: {
  title: string;
  description?: string;
  subtitle?: string;
  groups: TierGroup[];
  valueOf: (g: TierGroup) => number | null;
  formatValue: (value: number, g: TierGroup) => string;
  maxValue?: number;
  showSBadge?: boolean;
  emptyMessage?: string;
}) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const rows = groups
    .map((g) => ({ group: g, value: valueOf(g) }))
    .filter((r): r is { group: TierGroup; value: number } => r.value != null);

  if (rows.length === 0) {
    return (
      <CollapsibleCard title={title} description={description}>
        <EmptyState message={emptyMessage} />
      </CollapsibleCard>
    );
  }

  const scaleMax = maxValue ?? Math.max(...rows.map((r) => r.value), 1);
  const selected = rows.find((r) => r.group.key === selectedKey) ?? null;

  return (
    <CollapsibleCard title={title} description={description}>
      {subtitle && <p className="mb-2 -mt-1 text-xs text-ink-warm-faint">{subtitle}</p>}
      <div className="space-y-1.5">
        {rows.map(({ group, value }) => {
          const active = selectedKey === group.key;
          return (
            <button
              key={group.key}
              type="button"
              onClick={() => setSelectedKey((prev) => (prev === group.key ? null : group.key))}
              aria-pressed={active}
              className="flex w-full items-center gap-2 text-left text-xs"
            >
              <span className="w-28 shrink-0 truncate text-ink-warm-faint">{group.label}</span>
              <span className="h-4 flex-1 overflow-hidden rounded bg-hairline">
                <span
                  className={`block h-full rounded transition ${active ? "bg-accent" : "bg-accent/55"}`}
                  style={{ width: `${Math.max((value / scaleMax) * 100, 2)}%` }}
                />
              </span>
              {/* Fixed-width slot, always present (just empty) when this row
                  has no S books -- reserving the space rather than omitting
                  the element keeps the flex-1 bar's width constant across
                  every row, so bars don't shrink on the rows that happen to
                  have a badge. */}
              {showSBadge && (
                <span className="flex w-16 shrink-0 justify-center">
                  {group.sCount > 0 && (
                    <span className="rounded-full bg-gold-ink/15 px-1.5 py-0.5 text-[10px] font-medium text-gold-ink">
                      {group.sCount} in S
                    </span>
                  )}
                </span>
              )}
              {/* Value is the trailing fixed-width element too -- flush to
                  the same right edge on every row regardless of the badge
                  slot's contents. */}
              <span className="w-24 shrink-0 text-right text-ink-warm">{formatValue(value, group)}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-3 border-t border-gold pt-3">
          <p className="mb-2 text-xs font-medium text-ink-warm">
            {selected.group.label} · {selected.group.books.length} book{selected.group.books.length === 1 ? "" : "s"}
          </p>
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {selected.group.books.map((book) => (
              <li key={book.book_id} className="flex items-center gap-2">
                <CoverThumb title={book.title} coverUrl={book.cover_url} />
                <div className="min-w-0 flex-1">
                  <Link href={`/books/${book.book_id}`} className="block truncate text-sm text-ink-warm hover:underline">
                    {book.title}
                  </Link>
                  <p className="truncate text-xs text-ink-warm-faint">{book.author}</p>
                </div>
                <span className="shrink-0 text-xs text-ink-warm-faint">{tierLabel(book.tier)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CollapsibleCard>
  );
}
