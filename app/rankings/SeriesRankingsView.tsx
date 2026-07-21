"use client";

import Link from "next/link";
import { useState } from "react";
import { fraunces } from "../shared/fonts";
import { STATUS_FLAGS } from "./types";
import type { SeriesListName, SeriesRankedRow, StatusFlag } from "./types";

const ROW_HEIGHT = 48; // px -- matches the h-12 row class; drag math assumes fixed-height rows

const STATUS_STYLE: Record<StatusFlag, { tag: string; className: string }> = {
  Complete: { tag: "C", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  "Not Complete": { tag: "NC", className: "border-gold bg-hairline text-ink-warm-faint" },
  Unpublished: { tag: "U", className: "border-accent/40 bg-accent/10 text-ink-warm-muted" },
};

function nextStatus(current: StatusFlag): StatusFlag {
  const idx = STATUS_FLAGS.indexOf(current);
  return STATUS_FLAGS[(idx + 1) % STATUS_FLAGS.length];
}

type DragState = { series: string; startIndex: number; currentIndex: number; offsetY: number };

// See RankingsView.tsx's identical helper -- while dragging, rows the
// dragged item is currently passing over visually slide out of the way by
// one row-height.
function rowShift(index: number, drag: DragState | null): number {
  if (!drag || index === drag.startIndex) return 0;
  const { startIndex, currentIndex } = drag;
  if (currentIndex > startIndex) return index > startIndex && index <= currentIndex ? -1 : 0;
  if (currentIndex < startIndex) return index >= currentIndex && index < startIndex ? 1 : 0;
  return 0;
}

export function SeriesRankingsView({
  listName,
  initialRows,
}: {
  listName: SeriesListName;
  initialRows: SeriesRankedRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const DEFAULT_VISIBLE = 10;
  const visibleRows = showAll ? rows : rows.slice(0, DEFAULT_VISIBLE);

  function handlePointerDown(e: React.PointerEvent, series: string, index: number) {
    e.preventDefault();
    const startClientY = e.clientY;
    const gesture = { startIndex: index, currentIndex: index };
    setDrag({ series, startIndex: index, currentIndex: index, offsetY: 0 });

    function onMove(ev: PointerEvent) {
      const deltaY = ev.clientY - startClientY;
      const rawIndex = gesture.startIndex + Math.round(deltaY / ROW_HEIGHT);
      const clamped = Math.max(0, Math.min(visibleRows.length - 1, rawIndex));
      gesture.currentIndex = clamped;
      setDrag({ series, startIndex: gesture.startIndex, currentIndex: clamped, offsetY: deltaY });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setDrag(null);
      commitDrag(series, gesture.startIndex, gesture.currentIndex);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function commitDrag(series: string, startIndex: number, currentIndex: number) {
    if (startIndex === currentIndex) return;
    const newRank = currentIndex + 1;

    setRows((prev) => {
      const reordered = [...prev];
      const [moved] = reordered.splice(startIndex, 1);
      reordered.splice(currentIndex, 0, moved);
      return reordered.map((r, i) => ({ ...r, rank: i + 1 }));
    });

    function revert() {
      setRows((prev) => {
        const reverted = [...prev];
        const [moved] = reverted.splice(currentIndex, 1);
        reverted.splice(startIndex, 0, moved);
        return reverted.map((r, i) => ({ ...r, rank: i + 1 }));
      });
    }

    fetch("/api/series-rankings/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list_name: listName, series, rank: newRank }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Reorder failed.");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Reorder failed.");
        revert();
      });
  }

  async function cycleStatus(series: string, current: StatusFlag) {
    const next = nextStatus(current);
    setStatusSaving(series);
    setError(null);
    setRows((prev) => prev.map((r) => (r.series === series ? { ...r, status_flag: next } : r)));
    try {
      const res = await fetch("/api/series-rankings/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list_name: listName, series, status_flag: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update status.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
      setRows((prev) => prev.map((r) => (r.series === series ? { ...r, status_flag: current } : r)));
    } finally {
      setStatusSaving(null);
    }
  }

  return (
    <>
      <p className="mb-1.5 text-xs text-ink-warm-faint">{rows.length} series</p>

      {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-warm-faint">Nothing in this list yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gold">
          {visibleRows.map((row, index) => {
            const isDragging = drag?.series === row.series;
            const shift = rowShift(index, drag);
            const translateY = isDragging ? drag!.offsetY : shift * ROW_HEIGHT;
            const status = STATUS_STYLE[row.status_flag];

            return (
              <div
                key={row.series}
                style={{
                  // See RankingsView.tsx's identical comment: omitted entirely
                  // when idle so this row's content never traps content
                  // below the next sibling row inside a stacking context.
                  transform: translateY !== 0 ? `translateY(${translateY}px)` : undefined,
                  transition: isDragging ? "none" : "transform 150ms ease",
                  zIndex: isDragging ? 10 : undefined,
                  position: isDragging ? "relative" : undefined,
                }}
                className={`flex h-12 items-center gap-2 border-b border-gold bg-surface-1 px-2 last:border-0 ${
                  isDragging ? "shadow-lg" : ""
                }`}
              >
                <button
                  type="button"
                  onPointerDown={(e) => handlePointerDown(e, row.series, index)}
                  aria-label="Drag to reorder"
                  className="touch-none select-none px-0.5 py-1 text-base leading-none text-ink-warm-faint active:cursor-grabbing"
                >
                  ⠿
                </button>

                <span className={`${fraunces.className} w-6 shrink-0 text-right text-base font-semibold text-ink-warm`}>
                  {index + 1}
                </span>

                <button
                  type="button"
                  onClick={() => cycleStatus(row.series, row.status_flag)}
                  disabled={statusSaving === row.series}
                  title="Click to change status"
                  className={`shrink-0 rounded-full border px-1 py-0.5 text-[9px] font-medium transition disabled:opacity-50 ${status.className}`}
                >
                  {status.tag}
                </button>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/library?series=${encodeURIComponent(row.series)}`}
                    className={`${fraunces.className} block truncate text-xs font-semibold text-ink-warm hover:underline`}
                  >
                    {row.series}
                  </Link>
                  <p className="truncate text-[11px] text-ink-warm-faint">
                    {row.books_read} read{row.avg_score != null ? ` · ${row.avg_score.toFixed(2)} avg` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rows.length > DEFAULT_VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
        >
          {showAll ? "Show top 10" : `Show all ${rows.length}`}
        </button>
      )}
    </>
  );
}
