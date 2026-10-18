"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import { coverGradient } from "../../shared/coverPalette";
import { computeArrangedGraph, dateToY, type ArrangedGraph, type BookPlacementRow, type NodePlacementRow } from "./arrangeMath";
import type { GatewayGraphSummary } from "./math";

const BOOK_W = 48;
const BOOK_H = 72;
const ROOT_SIZE = 48;
const PADDING = 160;
const STICKY_COL_W = 64;
const DRAG_THRESHOLD = 6;

async function persistBookX(bookId: number, x: number) {
  try {
    await fetch("/api/gateway-graph/place-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_id: bookId, x }),
    });
  } catch {
    // Best-effort -- local state already reflects the drop either way; a
    // failed save just means a reload would show the pre-drag position.
  }
}

async function persistNodeXY(nodeKey: string, x: number, y: number) {
  try {
    await fetch("/api/gateway-graph/place-node", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_key: nodeKey, x, y }),
    });
  } catch {
    // Best-effort, same as persistBookX above.
  }
}

async function persistEdge(bookId: number, curved: boolean, controlDx: number | null, controlDy: number | null) {
  try {
    await fetch("/api/gateway-graph/place-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book_id: bookId, edge_curved: curved, edge_control_dx: controlDx, edge_control_dy: controlDy }),
    });
  } catch {
    // Best-effort, same as persistBookX above.
  }
}

// A straight edge's control point sits exactly on the line -- invisible
// and impossible to grab -- so switching to curved for the first time
// needs a real starting offset, not (0,0).
const DEFAULT_CURVE_NUDGE = 28;

function RootAvatar({ name }: { name: string }) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br shadow-sm ring-2 ring-gold-ink ${coverGradient(
        name
      )}`}
    >
      <span className={`${fraunces.className} font-semibold text-black/30 dark:text-white/30`}>{name.charAt(0)}</span>
    </div>
  );
}

function edgePath(x1: number, y1: number, x2: number, y2: number, curved: boolean, controlDx: number | null, controlDy: number | null): string {
  if (!curved) return `M ${x1},${y1} L ${x2},${y2}`;
  const midX = (x1 + x2) / 2 + (controlDx ?? 0);
  const midY = (y1 + y2) / 2 + (controlDy ?? 0);
  return `M ${x1},${y1} Q ${midX},${midY} ${x2},${y2}`;
}

export function ArrangeTree({
  summary,
  bookPlacements,
  nodePlacements,
  onBack,
}: {
  summary: GatewayGraphSummary;
  bookPlacements: BookPlacementRow[];
  nodePlacements: NodePlacementRow[];
  onBack: () => void;
}) {
  const router = useRouter();
  const [fullscreen, setFullscreen] = useState(false);

  // Local-only until each POST resolves -- bookId -> x. Covers both a
  // reposition of an already-placed book AND a book just dragged in from
  // the tray (computeArrangedGraph treats a bookId present here the same
  // as a real DB row, including deriving its Y fresh from its own date).
  const [placementOverrides, setPlacementOverrides] = useState<Map<number, number>>(new Map());
  const [trayGhost, setTrayGhost] = useState<{ bookId: number; title: string; coverUrl: string | null; x: number; y: number } | null>(
    null
  );

  // bookId -> edge style, same local-until-POST-resolves pattern.
  const [edgeOverrides, setEdgeOverrides] = useState<Map<number, { curved: boolean; controlDx: number | null; controlDy: number | null }>>(
    new Map()
  );

  const effectiveBookPlacements = useMemo(() => {
    const merged = bookPlacements.map((p) => {
      let row = p;
      if (placementOverrides.has(p.book_id)) row = { ...row, x: placementOverrides.get(p.book_id)! };
      if (edgeOverrides.has(p.book_id)) {
        const edge = edgeOverrides.get(p.book_id)!;
        row = { ...row, edge_curved: edge.curved, edge_control_dx: edge.controlDx, edge_control_dy: edge.controlDy };
      }
      return row;
    });
    for (const [bookId, x] of placementOverrides) {
      if (!merged.some((p) => p.book_id === bookId)) {
        merged.push({ book_id: bookId, x, edge_curved: false, edge_control_dx: null, edge_control_dy: null });
      }
    }
    return merged;
  }, [bookPlacements, placementOverrides, edgeOverrides]);

  // Root (person/source) repositions -- nodeKey -> {x, y}, same
  // local-until-POST-resolves pattern as placementOverrides above.
  const [nodeOverrides, setNodeOverrides] = useState<Map<string, { x: number; y: number }>>(new Map());

  const effectiveNodePlacements = useMemo(() => {
    return nodePlacements.map((p) => (nodeOverrides.has(p.node_key) ? { ...p, ...nodeOverrides.get(p.node_key)! } : p));
  }, [nodePlacements, nodeOverrides]);

  const graph: ArrangedGraph = useMemo(
    () => computeArrangedGraph(summary, effectiveBookPlacements, effectiveNodePlacements),
    [summary, effectiveBookPlacements, effectiveNodePlacements]
  );

  const xs = graph.nodes.map((n) => n.x);
  const minX = xs.length > 0 ? Math.min(...xs) : 0;
  const maxX = xs.length > 0 ? Math.max(...xs) : 0;
  const offsetX = minX - PADDING;
  const offsetY = graph.minY - PADDING;
  const width = maxX - offsetX + PADDING;
  const height = graph.maxY - offsetY + PADDING;

  // Bands are ordered by bloodline SIZE (the seed script's own lane-walk),
  // not by date -- so the top-left corner at the default scroll position
  // can easily land on empty space even though there's plenty of content
  // just a bit further down (confirmed: it does, for this real dataset).
  // Same fix WholeTreeByDate.tsx already uses for the identical problem:
  // open centered on the median node instead of the literal top.
  const medianFrac = useMemo(() => {
    if (graph.nodes.length === 0) return 0;
    const sorted = [...graph.nodes.map((n) => n.y)].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return height > 0 ? (median - offsetY) / height : 0;
  }, [graph.nodes, offsetY, height]);

  const canvasElRef = useRef<HTMLDivElement | null>(null);
  const scrollToMedian = useCallback(
    (el: HTMLDivElement | null) => {
      canvasElRef.current = el;
      if (!el) return;
      el.scrollTop = Math.max(0, medianFrac * el.scrollHeight - el.clientHeight / 2);
    },
    [medianFrac]
  );

  // For direct-DOM-mutation during a reposition drag (bypassing React
  // state on every pointermove -- ~260 nodes mount at once with no
  // virtualization, so flowing every intermediate position through
  // setState would re-render the whole tree on each move).
  const bookElRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const rootElRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Dragging an already-placed book: X only, Y never changes during the
  // gesture (it's locked to the book's own date, not the pointer).
  // Pattern modeled on TierBoard.tsx -- refs hold the live gesture state
  // read at pointerup, listeners attach to `window` inside onPointerDown
  // and are removed on pointerup/pointercancel, a drag-distance threshold
  // distinguishes a tap (navigate to the dossier) from an actual drag.
  function handleBookPointerDown(e: React.PointerEvent, bookId: number, startNodeX: number) {
    if (e.button !== 0) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let dragStarted = false;
    let liveX = startNodeX;
    const el = bookElRefs.current.get(bookId);

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      if (!dragStarted && Math.hypot(dx, dy) > DRAG_THRESHOLD) dragStarted = true;
      if (!dragStarted) return;
      liveX = startNodeX + dx;
      if (el) el.style.left = `${liveX - offsetX}px`;
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!dragStarted) {
        router.push(`/books/${bookId}`);
        return;
      }
      setPlacementOverrides((prev) => new Map(prev).set(bookId, liveX));
      void persistBookX(bookId, liveX);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // Dragging a book in from the tray -- no existing canvas node to mutate
  // directly, so this one goes through a floating ghost + React state
  // (a single small element re-rendering per move, not the whole tree).
  function handleTrayPointerDown(e: React.PointerEvent, bookId: number, title: string, coverUrl: string | null) {
    if (e.button !== 0) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let dragStarted = false;

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      if (!dragStarted && Math.hypot(dx, dy) > DRAG_THRESHOLD) dragStarted = true;
      if (!dragStarted) return;
      setTrayGhost({ bookId, title, coverUrl, x: ev.clientX, y: ev.clientY });
    }
    function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setTrayGhost(null);
      if (!dragStarted) return;

      const canvasEl = canvasElRef.current;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const withinCanvas = ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom;
      if (!withinCanvas) return;

      const x = ev.clientX - rect.left + canvasEl.scrollLeft - STICKY_COL_W + offsetX;
      setPlacementOverrides((prev) => new Map(prev).set(bookId, x));
      void persistBookX(bookId, x);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // Dragging a person/source avatar: free 2D, unlike a book's X-only drag
  // -- these have no date of their own to lock a Y to.
  function handleRootPointerDown(e: React.PointerEvent, nodeKey: string, startX: number, startY: number) {
    if (e.button !== 0) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let dragStarted = false;
    let liveX = startX;
    let liveY = startY;
    const el = rootElRefs.current.get(nodeKey);

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      if (!dragStarted && Math.hypot(dx, dy) > DRAG_THRESHOLD) dragStarted = true;
      if (!dragStarted) return;
      liveX = startX + dx;
      liveY = startY + dy;
      if (el) {
        el.style.left = `${liveX - offsetX}px`;
        el.style.top = `${liveY - offsetY}px`;
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!dragStarted) return;
      setNodeOverrides((prev) => new Map(prev).set(nodeKey, { x: liveX, y: liveY }));
      void persistNodeXY(nodeKey, liveX, liveY);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // Live offset while dragging an edge's control dot -- a single element
  // re-rendering per move, not the whole tree, so plain state (not a DOM
  // ref) is fine here, unlike the book/root drags above.
  const [draggingControl, setDraggingControl] = useState<{ bookId: number; dx: number; dy: number } | null>(null);

  // A plain click (no drag) toggles straight <-> curved; dragging the dot
  // (from either state) sets curved=true with the dragged offset -- you
  // don't need to click-to-curve first before you can pull a line where
  // you want it.
  function handleControlPointerDown(e: React.PointerEvent, bookId: number, curved: boolean, startControlDx: number, startControlDy: number) {
    e.stopPropagation();
    if (e.button !== 0) return;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let dragStarted = false;
    let liveDx = startControlDx;
    let liveDy = startControlDy;

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      if (!dragStarted && Math.hypot(dx, dy) > DRAG_THRESHOLD) dragStarted = true;
      if (!dragStarted) return;
      liveDx = startControlDx + dx;
      liveDy = startControlDy + dy;
      setDraggingControl({ bookId, dx: liveDx, dy: liveDy });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setDraggingControl(null);

      if (!dragStarted) {
        const nextCurved = !curved;
        const nextDx = nextCurved ? DEFAULT_CURVE_NUDGE : null;
        const nextDy = nextCurved ? 0 : null;
        setEdgeOverrides((prev) => new Map(prev).set(bookId, { curved: nextCurved, controlDx: nextDx, controlDy: nextDy }));
        void persistEdge(bookId, nextCurved, nextDx, nextDy);
        return;
      }
      setEdgeOverrides((prev) => new Map(prev).set(bookId, { curved: true, controlDx: liveDx, controlDy: liveDy }));
      void persistEdge(bookId, true, liveDx, liveDy);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // dateToY is a pure function of the date string alone (no dependency on
  // anything else in the dataset -- see arrangeMath.ts's frozen-epoch
  // note), so a tick's Y is just a direct call, not an interpolation.
  const yearTicks = useMemo(() => {
    if (!graph.minDate || !graph.maxDate) return [];
    const startYear = Number(graph.minDate.slice(0, 4));
    const endYear = Number(graph.maxDate.slice(0, 4));
    const ticks: { year: number; y: number }[] = [];
    for (let year = startYear; year <= endYear; year++) {
      ticks.push({ year, y: dateToY(`${year}-01-01`) - offsetY });
    }
    return ticks;
  }, [graph.minDate, graph.maxDate, offsetY]);

  const headerRow = (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className={`${fraunces.className} text-base font-semibold text-ink-warm`}>Arrange the tree</h2>
        <p className="mt-0.5 max-w-2xl text-xs text-ink-warm-faint">
          Drag a book to reposition it -- its row is locked to when you finished it, you control where horizontally.
          Lines are drawn from what you already told it led to; toggle a line to curved and drag its dot to route it
          around anything in the way.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          className="whitespace-nowrap rounded-full border border-gold-strong bg-surface-2 px-3.5 py-1.5 text-xs text-ink-warm-muted transition hover:bg-gold-ink hover:text-white"
        >
          {fullscreen ? "✕ Exit fullscreen" : "⛶ Expand"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="whitespace-nowrap rounded-full border border-gold-strong bg-surface-2 px-3.5 py-1.5 text-xs text-ink-warm-muted transition hover:bg-gold-ink hover:text-white"
        >
          ← Back to bloodlines
        </button>
      </div>
    </div>
  );

  const tray = graph.tray.length > 0 && (
    <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-dashed border-gold-strong bg-surface-1 p-3">
      <p className="w-full text-xs text-ink-warm-faint">{graph.tray.length} to place -- drag onto the canvas below:</p>
      {graph.tray.map((b) => (
        <div
          key={b.key}
          onPointerDown={(e) => handleTrayPointerDown(e, b.bookId, b.title, b.coverUrl)}
          className="flex touch-none select-none flex-col items-center gap-1"
          style={{ width: BOOK_W }}
        >
          <CoverThumb title={b.title} coverUrl={b.coverUrl} className="aspect-[2/3] w-full cursor-grab" />
        </div>
      ))}
    </div>
  );

  const ghost = trayGhost && (
    <div
      className="pointer-events-none fixed z-50"
      style={{ left: trayGhost.x, top: trayGhost.y, width: BOOK_W, height: BOOK_H, transform: "translate(-50%, -50%)" }}
    >
      <CoverThumb title={trayGhost.title} coverUrl={trayGhost.coverUrl} className="h-full w-full rounded shadow-lg" />
    </div>
  );

  const canvasBody = (
    <div className={`rounded-2xl border border-gold bg-surface-1 p-4 ${fullscreen ? "flex min-h-0 flex-1 flex-col" : ""}`}>
      <div ref={scrollToMedian} className={fullscreen ? "min-h-0 flex-1 overflow-auto" : "max-h-[70vh] overflow-auto"}>
        <div className="relative" style={{ width: 64 + width, height }}>
          <div className="sticky left-0 z-10 h-full w-16 bg-surface-1">
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gold-strong" />
            {yearTicks.map((t) => (
              <div key={t.year} className="absolute left-0 right-0 flex -translate-y-1/2 flex-col items-center" style={{ top: t.y }}>
                <span className="h-2.5 w-2.5 rounded-full bg-gold-ink shadow-[0_0_0_4px_var(--surface-1)]" />
                <span className="mt-1 text-xs font-bold text-ink-warm-muted">{t.year}</span>
              </div>
            ))}
          </div>
          <svg className="absolute left-16 top-0 overflow-visible" style={{ width, height }}>
            {yearTicks.map((t) => (
              <line key={t.year} x1={0} x2={width} y1={t.y} y2={t.y} className="stroke-gold" strokeDasharray="4 4" opacity={0.4} />
            ))}
            {graph.edges.map((e) => {
              const x1 = e.x1 - offsetX;
              const y1 = e.y1 - offsetY;
              const x2 = e.x2 - offsetX;
              const y2 = e.y2 - offsetY;
              const live = draggingControl?.bookId === e.bookId ? draggingControl : null;
              const controlDx = live ? live.dx : e.controlDx;
              const controlDy = live ? live.dy : e.controlDy;
              const curved = live ? true : e.curved;
              const dotX = (x1 + x2) / 2 + (curved ? (controlDx ?? 0) : 0);
              const dotY = (y1 + y2) / 2 + (curved ? (controlDy ?? 0) : 0);
              return (
                <g key={e.bookId}>
                  <path
                    d={edgePath(x1, y1, x2, y2, curved, controlDx, controlDy)}
                    fill="none"
                    className="stroke-gold-strong"
                    strokeWidth={1.5}
                  />
                  {/* Always present, not just when curved -- a click here
                      is how a straight edge BECOMES curved in the first
                      place; dragging it works from either state. */}
                  <circle
                    cx={dotX}
                    cy={dotY}
                    r={5}
                    className={`touch-none cursor-grab ${curved ? "fill-accent-coral" : "fill-gold-strong opacity-0 hover:opacity-60"}`}
                    style={{ pointerEvents: "auto" }}
                    onPointerDown={(ev) => handleControlPointerDown(ev, e.bookId, e.curved, e.controlDx ?? 0, e.controlDy ?? 0)}
                  />
                </g>
              );
            })}
          </svg>
          <div className="absolute left-16 top-0" style={{ width, height }}>
            {graph.nodes.map((n) => {
              const left = n.x - offsetX;
              const top = n.y - offsetY;
              const ref =
                n.kind === "book"
                  ? (el: HTMLDivElement | null) => {
                      if (el) bookElRefs.current.set(n.bookId, el);
                      else bookElRefs.current.delete(n.bookId);
                    }
                  : (el: HTMLDivElement | null) => {
                      if (el) rootElRefs.current.set(n.key, el);
                      else rootElRefs.current.delete(n.key);
                    };
              const onPointerDown =
                n.kind === "book"
                  ? (e: React.PointerEvent) => handleBookPointerDown(e, n.bookId, n.x)
                  : (e: React.PointerEvent) => handleRootPointerDown(e, n.key, n.x, n.y);
              return (
                <div
                  key={n.key}
                  ref={ref}
                  onPointerDown={onPointerDown}
                  className="absolute flex touch-none select-none flex-col items-center cursor-grab"
                  style={{ left, top, transform: "translate(-50%, -50%)" }}
                >
                  {n.kind === "book" ? (
                    <div style={{ width: BOOK_W, height: BOOK_H }} className="overflow-hidden rounded shadow-md">
                      <CoverThumb title={n.title} coverUrl={n.coverUrl} className="h-full w-full" />
                    </div>
                  ) : (
                    <div style={{ width: ROOT_SIZE, height: ROOT_SIZE }}>
                      <RootAvatar name={n.name} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-paper px-4 py-4 sm:px-8 sm:py-6">
        {headerRow}
        {tray}
        {canvasBody}
        {ghost}
      </div>
    );
  }

  return (
    <div>
      {headerRow}
      {tray}
      {canvasBody}
      {ghost}
    </div>
  );
}
