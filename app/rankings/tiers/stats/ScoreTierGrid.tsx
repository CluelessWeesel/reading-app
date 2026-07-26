"use client";

import Link from "next/link";
import { Fragment, useRef, useState } from "react";
import { ChartTooltip } from "@/app/stats/ChartTooltip";
import { CoverThumb, EmptyState } from "@/app/stats/DistributionShared";
import { divergingColor } from "@/app/stats/divergingColor";
import { tierLabel } from "../tierColors";
import type { GridCell, ScoreTierGrid as ScoreTierGridData } from "./scoreGridMath";

type Hover = { cell: GridCell; x: number; y: number };

// A CSS-grid heat-grid rather than a scatter plot -- tier is only 7-8
// categorical columns, so dots at this cardinality overlap heavily and a
// grid of colored cells (agreement-shaded, count-labeled) reads cleaner.
// Click a cell to pin its book list open beneath, same interaction as
// DistributionCard's bar-chart drill-down.
export function ScoreTierGrid({ data }: { data: ScoreTierGridData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [selected, setSelected] = useState<GridCell | null>(null);

  function handleEnter(e: React.MouseEvent, cell: GridCell) {
    if (cell.count === 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ cell, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div>
      <div ref={containerRef} className="relative overflow-x-auto">
        <div
          className="grid w-max min-w-full gap-1"
          style={{ gridTemplateColumns: `3.75rem repeat(${data.columns.length}, minmax(2.75rem, 1fr))` }}
        >
          <div />
          {data.columns.map((tier) => (
            <div key={tier} className="pb-1 text-center text-[10px] font-medium uppercase text-ink-warm-faint">
              {tierLabel(tier)}
            </div>
          ))}

          {data.rows.map((band, rowIdx) => (
            <Fragment key={band.label}>
              <div className="flex items-center justify-end whitespace-nowrap pr-1.5 text-[9px] text-ink-warm-faint">
                {band.label}
              </div>
              {data.cells[rowIdx].map((cell) => {
                const isSelected = selected?.tier === cell.tier && selected?.band.label === cell.band.label;
                const { background, color } =
                  cell.count > 0 ? divergingColor(cell.agreement ?? 0.5) : { background: "transparent", color: "" };
                return (
                  <button
                    key={`${cell.tier}-${cell.band.label}`}
                    type="button"
                    disabled={cell.count === 0}
                    onClick={() => setSelected((prev) => (prev === cell ? null : cell))}
                    onMouseEnter={(e) => handleEnter(e, cell)}
                    onMouseLeave={() => setHover((h) => (h?.cell === cell ? null : h))}
                    className={`flex aspect-square items-center justify-center rounded text-xs font-medium transition ${
                      cell.count === 0 ? "bg-hairline/40" : "hover:ring-2 hover:ring-accent"
                    } ${isSelected ? "ring-2 ring-accent" : ""}`}
                    style={cell.count > 0 ? { background, color } : undefined}
                  >
                    {cell.count > 0 ? cell.count : ""}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>

        {hover && (
          <ChartTooltip x={hover.x} y={hover.y}>
            <p className="font-semibold">
              {tierLabel(hover.cell.tier)} · score {hover.cell.band.label}
            </p>
            <p className="text-ink-warm-faint">
              {hover.cell.count} book{hover.cell.count === 1 ? "" : "s"} ·{" "}
              {hover.cell.agreement != null ? `${Math.round(hover.cell.agreement * 100)}% agreement` : ""}
            </p>
          </ChartTooltip>
        )}
      </div>

      <p className="mt-2 text-xs text-ink-warm-faint">
        Green cells sit near the diagonal (tier and score agree) · red cells sit far from it.
      </p>

      {selected && (
        <div className="mt-3 border-t border-gold pt-3">
          <p className="mb-2 text-xs font-medium text-ink-warm">
            {tierLabel(selected.tier)} · score {selected.band.label} · {selected.books.length} book
            {selected.books.length === 1 ? "" : "s"}
          </p>
          {selected.books.length === 0 ? (
            <EmptyState message="No books here." />
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {selected.books.map((book) => (
                <li key={book.book_id} className="flex items-center gap-2">
                  <CoverThumb title={book.title} coverUrl={book.cover_url} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/books/${book.book_id}`} className="block truncate text-sm text-ink-warm hover:underline">
                      {book.title}
                    </Link>
                    <p className="truncate text-xs text-ink-warm-faint">{book.author}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-warm-faint">{book.score?.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
