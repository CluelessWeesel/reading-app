"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import { capacityFor, totalPlacedFromBoard } from "./tierMath";
import { SwapPicker } from "./SwapPicker";
import { ALL_TIERS } from "./types";
import type { Capacities, TierBoardData, TierBook, TierId } from "./types";

const DRAG_THRESHOLD = 6; // px -- shorter moves are a tap/click, not a drag

const TIER_LABEL_CLASS: Record<TierId, string> = {
  S: "text-gold-ink",
  A: "text-accent-purple",
  B: "text-accent-blue",
  C: "text-accent-teal",
  D: "text-accent-coral",
  E: "text-accent-amber",
  F: "text-accent-pink",
  holding: "text-ink-warm-faint",
};

type DragInfo = { bookId: number; fromTier: TierId; title: string; coverUrl: string | null };
type PendingSwap = {
  bookId: number;
  fromTier: TierId;
  title: string;
  toTier: TierId;
  toIndex: number;
  tier: TierId;
  capacity: number;
};

// Flattens every tier into a single book_id lookup -- the server's
// response only ever carries book_id ordering (see the route's own
// comment on why), so reconstructing full display data after a move means
// mapping each returned id back to whichever TierBook this component
// already knows, from before the move.
function bookLookup(board: TierBoardData): Map<number, TierBook> {
  const map = new Map<number, TierBook>();
  for (const tier of ALL_TIERS) for (const book of board[tier]) map.set(book.book_id, book);
  return map;
}

export function TierBoard({
  initialBoard,
  capacities,
}: {
  initialBoard: TierBoardData;
  capacities: Capacities;
}) {
  const router = useRouter();
  const [board, setBoard] = useState(initialBoard);
  const [dragging, setDragging] = useState<DragInfo | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverTier, setHoverTier] = useState<TierId | null>(null);
  const [hoveredBook, setHoveredBook] = useState<TierBook | null>(null);
  const [pendingSwap, setPendingSwap] = useState<PendingSwap | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mutable, always-current mirrors of the hover state -- pointermove/up
  // handlers are attached once per gesture and would otherwise close over
  // whatever hoverTier/hoverIndex were at attach time, not their latest value.
  const hoverTierRef = useRef<TierId | null>(null);
  const hoverIndexRef = useRef<number>(0);

  const totalPlaced = totalPlacedFromBoard(board);

  function capacityInfo(tier: Exclude<TierId, "holding">) {
    const capacity = capacityFor(capacities[tier], totalPlaced);
    const count = board[tier].length;
    return { capacity, count, full: count >= capacity };
  }

  async function persistPlacement(
    bookId: number,
    fromTier: TierId,
    toTier: TierId,
    toIndex: number,
    displaced?: { bookId: number; toTier: TierId }
  ): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tier-board/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: bookId,
          to_tier: toTier,
          to_index: toIndex,
          from_tier_hint: fromTier,
          displaced_book_id: displaced?.bookId,
          displaced_to_tier: displaced?.toTier,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.error === "tier-full") {
        const book = findBook(board, bookId);
        if (book) {
          setPendingSwap({ bookId, fromTier, title: book.title, toTier, toIndex, tier: data.tier, capacity: data.capacity });
        }
        return false;
      }
      if (!res.ok) throw new Error(data.error || "Move failed.");

      setBoard((prev) => {
        const lookup = bookLookup(prev);
        const next: TierBoardData = { ...prev };
        for (const tier of ALL_TIERS) {
          const ids: number[] | undefined = data.order[tier];
          if (!ids) continue;
          next[tier] = ids
            .map((id: number, i: number) => {
              const known = lookup.get(id);
              return known ? { ...known, position: i } : null;
            })
            .filter((b: TierBook | null): b is TierBook => b !== null);
        }
        return next;
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Move failed.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function findBook(b: TierBoardData, bookId: number): TierBook | null {
    for (const tier of ALL_TIERS) {
      const found = b[tier].find((x) => x.book_id === bookId);
      if (found) return found;
    }
    return null;
  }

  function handlePointerDown(e: React.PointerEvent, bookId: number, fromTier: TierId, title: string, coverUrl: string | null) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let dragStarted = false;

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragStarted && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        dragStarted = true;
        setDragging({ bookId, fromTier, title, coverUrl });
      }
      if (!dragStarted) return;

      setGhostPos({ x: ev.clientX, y: ev.clientY });

      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const rowEl = el?.closest("[data-tier-row]") as HTMLElement | null;
      const tileEl = el?.closest("[data-tile]") as HTMLElement | null;
      const tier = (rowEl?.dataset.tierRow as TierId | undefined) ?? null;

      hoverTierRef.current = tier;
      setHoverTier(tier);

      if (tier) {
        let index: number;
        if (tileEl && tileEl.dataset.index != null) {
          const rect = tileEl.getBoundingClientRect();
          const before = ev.clientX < rect.left + rect.width / 2;
          const tileIndex = Number(tileEl.dataset.index);
          index = before ? tileIndex : tileIndex + 1;
        } else {
          index = board[tier].length;
        }
        hoverIndexRef.current = index;
      }
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);

      if (!dragStarted) {
        router.push(`/books/${bookId}`);
      } else {
        const targetTier = hoverTierRef.current;
        const targetIndex = hoverIndexRef.current;
        if (targetTier && !(targetTier === fromTier && targetIndex === indexWithin(board, fromTier, bookId))) {
          persistPlacement(bookId, fromTier, targetTier, targetIndex);
        }
      }

      setDragging(null);
      setGhostPos(null);
      setHoverTier(null);
      hoverTierRef.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function indexWithin(b: TierBoardData, tier: TierId, bookId: number): number {
    return b[tier].findIndex((x) => x.book_id === bookId);
  }

  async function confirmSwap(displacedBookId: number, displacedToTier: TierId) {
    if (!pendingSwap) return;
    const ok = await persistPlacement(pendingSwap.bookId, pendingSwap.fromTier, pendingSwap.toTier, pendingSwap.toIndex, {
      bookId: displacedBookId,
      toTier: displacedToTier,
    });
    if (ok) setPendingSwap(null);
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="min-h-[1.25rem] text-center text-xs text-ink-warm-faint">
        {hoveredBook
          ? `${hoveredBook.title}${hoveredBook.author ? ` — ${hoveredBook.author}` : ""}${
              hoveredBook.score != null ? ` · ${hoveredBook.score.toFixed(2)}` : ""
            }`
          : "Hover a cover for details · click to open · drag to move"}
      </div>

      {ALL_TIERS.map((tier) => {
        const books = board[tier];
        const isPlaceable = tier !== "holding";
        const info = isPlaceable ? capacityInfo(tier as Exclude<TierId, "holding">) : null;
        const isDropTarget = hoverTier === tier;
        const visibleBooks = dragging && dragging.fromTier === tier ? books.filter((b) => b.book_id !== dragging.bookId) : books;

        return (
          <div key={tier} className="rounded-xl border border-gold bg-surface-1 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className={`${fraunces.className} text-lg font-semibold uppercase ${TIER_LABEL_CLASS[tier]}`}>
                {tier === "holding" ? "Holding" : tier}
              </p>
              {info && (
                <p className={`text-xs ${info.full ? "font-medium text-accent-coral" : "text-ink-warm-faint"}`}>
                  {tier} · {info.count} / {info.capacity}
                  {info.full ? " full" : ""}
                </p>
              )}
              {!isPlaceable && <p className="text-xs text-ink-warm-faint">{books.length} · uncapped</p>}
            </div>

            <div
              data-tier-row={tier}
              className={`flex min-h-[4.5rem] flex-wrap gap-2 rounded-lg p-1.5 transition-colors ${
                isDropTarget ? "bg-accent/10 ring-2 ring-accent" : ""
              }`}
            >
              {visibleBooks.length === 0 && !isDropTarget && (
                <p className="px-2 py-4 text-xs text-ink-warm-faint">Nothing here yet.</p>
              )}
              {visibleBooks.map((book, i) => (
                <div
                  key={book.book_id}
                  data-tile
                  data-index={i}
                  onPointerDown={(e) => handlePointerDown(e, book.book_id, tier, book.title, book.cover_url)}
                  onMouseEnter={() => setHoveredBook(book)}
                  onMouseLeave={() => setHoveredBook((prev) => (prev?.book_id === book.book_id ? null : prev))}
                  className="touch-none select-none"
                >
                  <CoverThumb title={book.title} coverUrl={book.cover_url} className="aspect-[2/3] w-12 shadow-sm sm:w-14" />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {dragging && ghostPos && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rotate-3 opacity-90 shadow-xl"
          style={{ left: ghostPos.x, top: ghostPos.y }}
        >
          <CoverThumb title={dragging.title} coverUrl={dragging.coverUrl} className="aspect-[2/3] w-14" />
        </div>
      )}

      {pendingSwap && (
        <SwapPicker
          tier={pendingSwap.tier}
          current={board[pendingSwap.tier]}
          incomingTitle={pendingSwap.title}
          onConfirm={confirmSwap}
          onCancel={() => setPendingSwap(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
