"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Cover } from "../shared/Cover";
import { fraunces } from "../shared/fonts";
import { HonourBadge } from "../shared/HonourBadge";
import type { HonourItem } from "../shared/HonourBadge";
import { todayLocalIso } from "../shared/isoDate";
import { classifyYearEdit } from "../shared/adjustmentWindow";
import { EditGuardModal } from "../shared/EditGuardModal";
import { AdjustmentWindowPanel } from "./AdjustmentWindowPanel";
import { Podium } from "./Podium";
import type { AdjustmentWindowData, Movement, RankedRow, UnrankedRow, YearData } from "./types";

const ROW_HEIGHT = 40; // px -- matches the h-10 row class; drag math assumes fixed-height rows

type DragState = { bookId: number; startIndex: number; currentIndex: number; offsetY: number };

// While dragging, rows the dragged item is currently passing over visually
// slide out of the way by one row-height; everything else stays put. Only
// the gesture's live start/current index matter here, not the eventual
// server-persisted rank.
function rowShift(index: number, drag: DragState | null): number {
  if (!drag || index === drag.startIndex) return 0;
  const { startIndex, currentIndex } = drag;
  if (currentIndex > startIndex) return index > startIndex && index <= currentIndex ? -1 : 0;
  if (currentIndex < startIndex) return index >= currentIndex && index < startIndex ? 1 : 0;
  return 0;
}

function MovementIndicator({ movement }: { movement?: Movement }) {
  if (!movement || movement.old_rank == null) {
    return <span className="w-12 shrink-0 text-center text-xs text-ink-warm-faint">—</span>;
  }
  const delta = movement.old_rank - movement.new_rank; // positive = rank number went down = moved up
  if (delta === 0) {
    return <span className="w-12 shrink-0 text-center text-xs text-ink-warm-faint">—</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={`flex w-12 shrink-0 items-center justify-center gap-0.5 text-xs font-medium ${
        up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      }`}
    >
      {up ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
}

function InsertPicker({
  ranked,
  insertAfter,
  onChangeInsertAfter,
  onConfirm,
  onCancel,
  saving,
}: {
  ranked: RankedRow[];
  insertAfter: number;
  onChangeInsertAfter: (i: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const newRank = insertAfter + 2;
  function displayRank(idx: number) {
    return idx + 1 + (idx > insertAfter ? 1 : 0);
  }
  return (
    <div className="mt-2 rounded-lg border border-gold bg-surface-1 p-2">
      <p className="mb-2 text-xs text-ink-warm-faint">Tap where it lands.</p>
      <div className="max-h-64 overflow-y-auto rounded-md border border-gold">
        <button
          type="button"
          onClick={() => onChangeInsertAfter(-1)}
          className={`block w-full border-b border-gold px-2 py-1.5 text-left text-xs last:border-0 ${
            insertAfter === -1 ? "bg-accent/10 font-medium text-ink-warm" : "text-ink-warm-faint hover:bg-hover"
          }`}
        >
          Place at #1
        </button>
        {ranked.map((r, idx) => (
          <button
            key={r.book_id ?? idx}
            type="button"
            onClick={() => onChangeInsertAfter(idx)}
            className={`flex w-full items-center gap-2 border-b border-gold px-2 py-1.5 text-left text-xs last:border-0 ${
              insertAfter === idx ? "bg-hover font-medium text-ink-warm" : "text-ink-warm-faint hover:bg-hover"
            }`}
          >
            <span className="w-5 text-right">{displayRank(idx)}</span>
            <span className="min-w-0 flex-1 truncate">{r.title}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-gold px-3 py-1 text-xs text-ink-warm-muted hover:bg-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className="rounded-full bg-accent px-3 py-1 text-xs text-on-accent transition hover:brightness-95 disabled:opacity-50"
        >
          {saving ? "Inserting..." : `Insert at #${newRank}`}
        </button>
      </div>
    </div>
  );
}

export function RankingsView({
  data: initialData,
  years,
  defaultYear,
  bookHonours,
  sealedYears,
  adjustmentWindow,
}: {
  data: Record<number, YearData>;
  years: number[];
  defaultYear: number;
  bookHonours: Record<number, HonourItem[]>;
  sealedYears: number[];
  adjustmentWindow: AdjustmentWindowData;
}) {
  const [dataByYear, setDataByYear] = useState(initialData);
  const [activeYear, setActiveYear] = useState(defaultYear);
  const [showUnranked, setShowUnranked] = useState(false);
  const sealedSet = new Set(sealedYears);
  const [showHonours, setShowHonours] = useState(() => sealedSet.has(defaultYear));
  const [podiumMode, setPodiumMode] = useState(false);
  const [insertTarget, setInsertTarget] = useState<UnrankedRow | null>(null);
  const [insertAfter, setInsertAfter] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pendingReorder, setPendingReorder] = useState<{
    bookId: number;
    title: string;
    year: number;
    oldRank: number;
    newRank: number;
    classification: "adjustment" | "historical";
  } | null>(null);
  const pendingDragIndices = useRef<{ startIndex: number; currentIndex: number } | null>(null);

  const yearData = dataByYear[activeYear];

  function handleCoverChange(bookId: number, coverUrl: string | null) {
    setDataByYear((prev) => {
      const next: Record<number, YearData> = { ...prev };
      for (const y of Object.keys(next).map(Number)) {
        next[y] = {
          ...next[y],
          ranked: next[y].ranked.map((r) => (r.book_id === bookId ? { ...r, cover_url: coverUrl } : r)),
          unranked: next[y].unranked.map((u) => (u.book_id === bookId ? { ...u, cover_url: coverUrl } : u)),
        };
      }
      return next;
    });
  }

  function handlePointerDown(e: React.PointerEvent, bookId: number, index: number) {
    e.preventDefault();
    const startClientY = e.clientY;
    const gesture = { startIndex: index, currentIndex: index };
    setDrag({ bookId, startIndex: index, currentIndex: index, offsetY: 0 });

    function onMove(ev: PointerEvent) {
      const deltaY = ev.clientY - startClientY;
      const rawIndex = gesture.startIndex + Math.round(deltaY / ROW_HEIGHT);
      const clamped = Math.max(0, Math.min(yearData.ranked.length - 1, rawIndex));
      gesture.currentIndex = clamped;
      setDrag({ bookId, startIndex: gesture.startIndex, currentIndex: clamped, offsetY: deltaY });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setDrag(null);
      commitDrag(bookId, gesture.startIndex, gesture.currentIndex);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // Reorders the local array optimistically and fires the actual request,
  // reverting on failure -- shared by the unguarded ("current" year) path
  // and the guarded confirm handler below, once a reason/confirmation (if
  // any) has been obtained.
  function applyReorder(
    bookId: number,
    year: number,
    startIndex: number,
    currentIndex: number,
    extra: Record<string, unknown>
  ) {
    const oldRank = startIndex + 1;
    const newRank = currentIndex + 1;

    setDataByYear((prev) => {
      const yd = prev[year];
      const reordered = [...yd.ranked];
      const [moved] = reordered.splice(startIndex, 1);
      reordered.splice(currentIndex, 0, moved);
      return { ...prev, [year]: { ...yd, ranked: reordered } };
    });

    return fetch("/api/book-rankings/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, book_id: bookId, rank: newRank, ...extra }),
    }).then(async (res) => {
      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        setDataByYear((prev) => {
          const yd = prev[year];
          const reverted = [...yd.ranked];
          const [moved] = reverted.splice(currentIndex, 1);
          reverted.splice(startIndex, 0, moved);
          return { ...prev, [year]: { ...yd, ranked: reverted } };
        });
        throw new Error(resBody.error || "Reorder failed.");
      }
      setDataByYear((prev) => {
        const yd = prev[year];
        return { ...prev, [year]: { ...yd, movements: { ...yd.movements, [bookId]: { old_rank: oldRank, new_rank: newRank } } } };
      });
    });
  }

  function commitDrag(bookId: number, startIndex: number, currentIndex: number) {
    if (startIndex === currentIndex) return;
    const year = activeYear;
    const classification = classifyYearEdit(year, todayLocalIso());

    if (classification === "current") {
      applyReorder(bookId, year, startIndex, currentIndex, {}).catch((err) => {
        setError(err instanceof Error ? err.message : "Reorder failed.");
      });
      return;
    }

    const row = yearData.ranked[startIndex];
    setPendingReorder({
      bookId,
      title: row.title,
      year,
      oldRank: startIndex + 1,
      newRank: currentIndex + 1,
      classification,
    });
    // Stashed for the guard's confirm handler, since startIndex/currentIndex
    // aren't otherwise carried on pendingReorder.
    pendingDragIndices.current = { startIndex, currentIndex };
  }

  async function confirmPendingReorder(reason?: string) {
    if (!pendingReorder || !pendingDragIndices.current) return;
    const { bookId, year, classification } = pendingReorder;
    const { startIndex, currentIndex } = pendingDragIndices.current;
    const extra =
      classification === "adjustment" ? { reason } : { historicalConfirmed: true };
    await applyReorder(bookId, year, startIndex, currentIndex, extra);
    setPendingReorder(null);
    pendingDragIndices.current = null;
  }

  function openInsertPicker(entry: UnrankedRow) {
    setInsertTarget(entry);
    setInsertAfter(yearData.ranked.length - 1);
    setError(null);
  }

  async function confirmInsert() {
    if (!insertTarget) return;
    const year = activeYear;
    const rank = insertAfter + 2;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/book-rankings/insert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          rank,
          book_id: insertTarget.book_id,
          title: insertTarget.title,
          score: insertTarget.score,
          had_star: false,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Insert failed.");
      }
      setDataByYear((prev) => {
        const yd = prev[year];
        const newRanked = [...yd.ranked];
        newRanked.splice(insertAfter + 1, 0, {
          book_id: insertTarget.book_id,
          rank,
          title: insertTarget.title,
          author: insertTarget.author,
          author_id: insertTarget.author_id,
          cover_url: insertTarget.cover_url,
          score: insertTarget.score,
          had_star: false,
        });
        return {
          ...prev,
          [year]: {
            ...yd,
            ranked: newRanked,
            unranked: yd.unranked.filter((e) => e.book_id !== insertTarget.book_id),
            movements: { ...yd.movements, [insertTarget.book_id]: { old_rank: null, new_rank: rank } },
          },
        };
      });
      setInsertTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Insert failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => {
                setActiveYear(y);
                setShowUnranked(false);
                setInsertTarget(null);
                setError(null);
                setShowHonours(sealedSet.has(y));
                setPodiumMode(false);
              }}
              aria-pressed={activeYear === y}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                activeYear === y
                  ? "bg-accent text-on-accent"
                  : "border border-gold bg-surface-1 text-ink-warm-muted hover:bg-hover"
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        {activeYear === adjustmentWindow.year && <AdjustmentWindowPanel data={adjustmentWindow} />}

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-warm-faint">
            {yearData.ranked.length} ranked ·{" "}
            <button
              type="button"
              onClick={() => setShowUnranked((v) => !v)}
              className="underline decoration-dotted underline-offset-4 hover:text-ink-warm"
            >
              {yearData.unranked.length} unranked
            </button>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHonours((v) => !v)}
              aria-pressed={showHonours}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                showHonours ? "border-accent bg-accent/10 text-ink-warm" : "border-gold text-ink-warm-faint hover:text-ink-warm"
              }`}
            >
              Show honours
            </button>
            {sealedSet.has(activeYear) && (
              <button
                type="button"
                onClick={() => setPodiumMode((v) => !v)}
                aria-pressed={podiumMode}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  podiumMode ? "border-accent bg-accent/10 text-ink-warm" : "border-gold text-ink-warm-faint hover:text-ink-warm"
                }`}
              >
                Podium
              </button>
            )}
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {podiumMode && sealedSet.has(activeYear) && <Podium ranked={yearData.ranked} />}

        {yearData.ranked.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-warm-faint">No books ranked for {activeYear} yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gold">
            {yearData.ranked.map((row, index) => {
              const isDragging = drag?.bookId === row.book_id && row.book_id != null;
              const shift = row.book_id != null ? rowShift(index, drag) : 0;
              const translateY = isDragging ? drag!.offsetY : shift * ROW_HEIGHT;
              const movement = row.book_id != null ? yearData.movements[row.book_id] : undefined;

              return (
                <div
                  key={row.book_id ?? `untracked-${row.title}`}
                  style={{
                    // Omitted entirely (not just "translateY(0px)") when idle --
                    // a transform of any kind creates a new CSS stacking
                    // context, which would trap this row's content (e.g. an
                    // honours tooltip) below the next sibling row instead of
                    // letting it paint on top when it pops open.
                    transform: translateY !== 0 ? `translateY(${translateY}px)` : undefined,
                    transition: isDragging ? "none" : "transform 150ms ease",
                    zIndex: isDragging ? 10 : undefined,
                    position: isDragging ? "relative" : undefined,
                  }}
                  className={`flex h-10 items-center gap-2 border-b border-gold bg-surface-1 px-2.5 last:border-0 ${
                    isDragging ? "shadow-lg" : ""
                  }`}
                >
                  <button
                    type="button"
                    onPointerDown={(e) => row.book_id != null && handlePointerDown(e, row.book_id, index)}
                    disabled={row.book_id == null}
                    aria-label="Drag to reorder"
                    className="touch-none select-none px-0.5 py-2 leading-none text-ink-warm-faint disabled:opacity-30 active:cursor-grabbing"
                  >
                    ⠿
                  </button>

                  <span
                    className={`${fraunces.className} relative w-5 shrink-0 text-right text-sm font-semibold text-ink-warm`}
                  >
                    {index + 1}
                    {row.had_star && (
                      <span
                        className="absolute -right-1.5 -top-1 text-[9px] text-accent-amber"
                        title="Adjusted before this app existed"
                      >
                        ✱
                      </span>
                    )}
                  </span>

                  <Cover
                    id={row.book_id ?? 0}
                    title={row.title}
                    coverUrl={row.cover_url}
                    onCoverChange={handleCoverChange}
                    apiPath={`/api/books/${row.book_id ?? 0}/cover`}
                    className="aspect-[2/3] w-6 shrink-0"
                    initialClassName="text-[8px]"
                  />

                  <div className="min-w-0 flex-1 truncate text-sm">
                    {row.book_id != null ? (
                      <Link href={`/books/${row.book_id}`} className={`${fraunces.className} font-semibold text-ink-warm hover:underline`}>
                        {row.title}
                      </Link>
                    ) : (
                      <span className={`${fraunces.className} font-semibold text-ink-warm`}>{row.title}</span>
                    )}
                    <span className="text-ink-warm-faint">
                      {" · "}
                      {row.author_id != null ? (
                        <Link href={`/authors/${row.author_id}`} className="hover:underline">
                          {row.author}
                        </Link>
                      ) : (
                        (row.author ?? "Unknown author")
                      )}
                      {row.score != null ? ` · ${row.score.toFixed(2)}` : ""}
                    </span>
                  </div>

                  {showHonours && row.book_id != null && (
                    <HonourBadge items={bookHonours[row.book_id] ?? []} />
                  )}

                  <MovementIndicator movement={movement} />
                </div>
              );
            })}
          </div>
        )}

        {showUnranked && (
          <div className="mt-6 rounded-xl border border-gold bg-surface-1 p-4">
            <h2 className={`${fraunces.className} mb-2 text-sm font-semibold text-ink-warm`}>Unranked</h2>
            {yearData.unranked.length === 0 ? (
              <p className="text-sm text-ink-warm-faint">Every {activeYear} read is ranked.</p>
            ) : (
              <ul className="divide-y divide-gold">
                {yearData.unranked.map((entry) => (
                  <li key={entry.book_id} className="py-2">
                    <div className="flex items-center gap-3">
                      <Cover
                        id={entry.book_id}
                        title={entry.title}
                        coverUrl={entry.cover_url}
                        onCoverChange={handleCoverChange}
                        apiPath={`/api/books/${entry.book_id}/cover`}
                        className="aspect-[2/3] w-8"
                        initialClassName="text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-warm">{entry.title}</p>
                        <p className="truncate text-xs text-ink-warm-faint">
                          {entry.author_id != null ? (
                            <Link href={`/authors/${entry.author_id}`} className="hover:underline">
                              {entry.author}
                            </Link>
                          ) : (
                            (entry.author ?? "Unknown author")
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openInsertPicker(entry)}
                        className="shrink-0 text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
                      >
                        Insert into rankings
                      </button>
                    </div>
                    {insertTarget?.book_id === entry.book_id && (
                      <InsertPicker
                        ranked={yearData.ranked}
                        insertAfter={insertAfter}
                        onChangeInsertAfter={setInsertAfter}
                        onConfirm={confirmInsert}
                        onCancel={() => setInsertTarget(null)}
                        saving={saving}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {pendingReorder && (
          <EditGuardModal
            mode={pendingReorder.classification}
            title={pendingReorder.classification === "adjustment" ? "Log an adjustment" : "Edit a finalized year"}
            description={`"${pendingReorder.title}" -- #${pendingReorder.oldRank} → #${pendingReorder.newRank}`}
            year={pendingReorder.year}
            onConfirm={confirmPendingReorder}
            onCancel={() => {
              setPendingReorder(null);
              pendingDragIndices.current = null;
            }}
          />
        )}
    </>
  );
}
