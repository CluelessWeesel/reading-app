"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import { coverGradient } from "../../shared/coverPalette";
import { computeArrangedGraph, dateToY, type ArrangedGraph, type BookPlacementRow, type NodePlacementRow } from "./arrangeMath";
import type { GatewayGraphSummary } from "./math";

const BOOK_W = 75;
const BOOK_H = 112.5;
const ROOT_SIZE = 70;
const PADDING = 160;
const STICKY_COL_W = 64;
const DRAG_THRESHOLD = 6;
// Temporarily off while arranging -- a slightly-short drag kept counting as
// a tap and navigating away to the book. Flip back to true to restore.
const OPEN_BOOK_ON_TAP = false;
// Same button steps as WholeTreeByDate.tsx; pinch / ctrl-wheel zooms
// continuously between the two ends.
const ZOOM_STEPS = [0.2, 0.35, 0.6, 0.8, 1, 1.25, 1.5, 2, 2.5];
const MIN_ZOOM = ZOOM_STEPS[0];
const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

// The world point under viewport position (viewX, viewY) at the current
// zoom -- captured before a zoom change so the layout effect can scroll
// that same point back under the same viewport position afterwards.
type ZoomAnchor = { worldX: number; worldY: number; viewX: number; viewY: number };
function anchorAt(el: HTMLDivElement, zoom: number, offsetX: number, offsetY: number, viewX: number, viewY: number): ZoomAnchor {
  return {
    worldX: (el.scrollLeft + viewX - STICKY_COL_W) / zoom + offsetX,
    worldY: (el.scrollTop + viewY) / zoom + offsetY,
    viewX,
    viewY,
  };
}

// Each returns whether the save actually landed (a non-2xx counts as a
// failure, not just a network error) so the caller can refresh the page's
// server data only on success.
async function persistBookX(bookId: number, x: number): Promise<boolean> {
  return postPlacement("/api/gateway-graph/place-book", { book_id: bookId, x });
}

async function persistNodeXY(nodeKey: string, x: number, y: number): Promise<boolean> {
  return postPlacement("/api/gateway-graph/place-node", { node_key: nodeKey, x, y });
}

async function persistEdge(bookId: number, shape: EdgeShape): Promise<boolean> {
  return postPlacement("/api/gateway-graph/place-book", {
    book_id: bookId,
    edge_curved: shape.curved,
    edge_control_dx: shape.controlDx,
    edge_control_dy: shape.controlDy,
    edge_control2_dx: shape.control2Dx,
    edge_control2_dy: shape.control2Dy,
  });
}

async function postPlacement(url: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) console.error(`Saving placement failed (${res.status}):`, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error("Saving placement failed:", err);
    return false;
  }
}

// Switching a straight edge to curved via the toolbar needs a visible
// starting bend, not (0,0). In control-point units -- the on-curve handle
// moves half this far.
const DEFAULT_CURVE_NUDGE = 56;
// Same idea for a straight edge switched to double: each handle starts
// this far off the line, on opposite sides, so it reads as an S at once.
const DEFAULT_S_NUDGE = 24;
const HANDLE_SIZE = 10;

// One edge's stored shape, mirroring the book_graph_placement columns.
// Straight: curved=false, everything null. Curved (single): controlD* is
// the quadratic's control-point offset from the chord midpoint. Double:
// controlD* / control2D* are the two on-curve handle offsets from the
// chord's 1/3 and 2/3 points (0035_gateway_edge_double_curve.sql).
type EdgeShape = {
  curved: boolean;
  controlDx: number | null;
  controlDy: number | null;
  control2Dx: number | null;
  control2Dy: number | null;
};
type EdgeStyle = "straight" | "curved" | "double";
const STRAIGHT: EdgeShape = { curved: false, controlDx: null, controlDy: null, control2Dx: null, control2Dy: null };

function edgeStyle(shape: EdgeShape): EdgeStyle {
  if (!shape.curved) return "straight";
  return shape.control2Dx != null ? "double" : "curved";
}

function shapeOf(e: ArrangedGraph["edges"][number]): EdgeShape {
  return { curved: e.curved, controlDx: e.controlDx, controlDy: e.controlDy, control2Dx: e.control2Dx, control2Dy: e.control2Dy };
}

type Pt = { x: number; y: number };

// Every handle is drawn ON the line, PowerPoint-connector style, never at
// the bezier's off-curve control points (confusing to grab).
// - Single curve: the handle is the quadratic's t=0.5 point, which is
//   exactly mid + control/2 -- so dragging it by d moves the stored control
//   offset by 2d.
// - Double curve: the handles are the cubic's t=1/3 and t=2/3 points,
//   stored directly as offsets h1/h2 from the chord's 1/3 and 2/3 points.
//   Solving B(1/3) = chord(1/3)+h1, B(2/3) = chord(2/3)+h2 for the cubic's
//   control points gives P1 = chord(1/3) + 3h1 - 1.5h2 and
//   P2 = chord(2/3) + 3h2 - 1.5h1 (cubicControls below).
// All values here are already in screen pixels (shape offsets x zoom).
function edgeGeometry(a: Pt, b: Pt, shape: EdgeShape, zoom: number): { d: string; handles: Pt[] } {
  const style = edgeStyle(shape);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (style === "straight") {
    // One handle at the midpoint -- dragging it is how a straight line
    // becomes curved without visiting the toolbar first.
    return { d: `M ${a.x},${a.y} L ${b.x},${b.y}`, handles: [mid] };
  }
  if (style === "curved") {
    const c = { x: mid.x + shape.controlDx! * zoom, y: mid.y + shape.controlDy! * zoom };
    return { d: `M ${a.x},${a.y} Q ${c.x},${c.y} ${b.x},${b.y}`, handles: [{ x: (mid.x + c.x) / 2, y: (mid.y + c.y) / 2 }] };
  }
  const h1 = { x: shape.controlDx! * zoom, y: shape.controlDy! * zoom };
  const h2 = { x: shape.control2Dx! * zoom, y: shape.control2Dy! * zoom };
  const chord1 = { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 };
  const chord2 = { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 };
  const { p1, p2 } = cubicControls(chord1, chord2, h1, h2);
  return {
    d: `M ${a.x},${a.y} C ${p1.x},${p1.y} ${p2.x},${p2.y} ${b.x},${b.y}`,
    handles: [
      { x: chord1.x + h1.x, y: chord1.y + h1.y },
      { x: chord2.x + h2.x, y: chord2.y + h2.y },
    ],
  };
}

function cubicControls(chord1: Pt, chord2: Pt, h1: Pt, h2: Pt): { p1: Pt; p2: Pt } {
  return {
    p1: { x: chord1.x + 3 * h1.x - 1.5 * h2.x, y: chord1.y + 3 * h1.y - 1.5 * h2.y },
    p2: { x: chord2.x + 3 * h2.x - 1.5 * h1.x, y: chord2.y + 3 * h2.y - 1.5 * h1.y },
  };
}

// Toolbar conversions keep the line looking the same where possible: a
// quadratic's offset from its chord at t is 4t(1-t) x (control/2), i.e.
// 4/9 of the control offset at both t=1/3 and t=2/3 -- so curved -> double
// starts with both handles exactly on the existing curve, and double ->
// curved inverts that from the handles' average.
function convertShape(shape: EdgeShape, to: EdgeStyle, a: Pt, b: Pt): EdgeShape {
  const from = edgeStyle(shape);
  if (to === "straight") return STRAIGHT;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const perp = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  if (to === "curved") {
    if (from === "double") {
      const k = 9 / 8; // (h1 + h2)/2 x 9/4
      return { ...STRAIGHT, curved: true, controlDx: (shape.controlDx! + shape.control2Dx!) * k, controlDy: (shape.controlDy! + shape.control2Dy!) * k };
    }
    return { ...STRAIGHT, curved: true, controlDx: perp.x * DEFAULT_CURVE_NUDGE, controlDy: perp.y * DEFAULT_CURVE_NUDGE };
  }
  if (from === "curved") {
    const hx = (shape.controlDx! * 4) / 9;
    const hy = (shape.controlDy! * 4) / 9;
    return { curved: true, controlDx: hx, controlDy: hy, control2Dx: hx, control2Dy: hy };
  }
  return {
    curved: true,
    controlDx: perp.x * DEFAULT_S_NUDGE,
    controlDy: perp.y * DEFAULT_S_NUDGE,
    control2Dx: -perp.x * DEFAULT_S_NUDGE,
    control2Dy: -perp.y * DEFAULT_S_NUDGE,
  };
}

// A handle drag by (dx, dy) world px. On a double curve each handle IS its
// stored offset, so it moves 1:1; on a straight/single curve the handle
// rides at half the control offset, so the control moves 2x.
function dragShape(start: EdgeShape, handleIndex: number, dx: number, dy: number): EdgeShape {
  if (edgeStyle(start) === "double") {
    return handleIndex === 0
      ? { ...start, controlDx: start.controlDx! + dx, controlDy: start.controlDy! + dy }
      : { ...start, control2Dx: start.control2Dx! + dx, control2Dy: start.control2Dy! + dy };
  }
  return { ...STRAIGHT, curved: true, controlDx: (start.controlDx ?? 0) + 2 * dx, controlDy: (start.controlDy ?? 0) + 2 * dy };
}

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

function EdgeToolbar({ left, top, style, onChange }: { left: number; top: number; style: EdgeStyle; onChange: (style: EdgeStyle) => void }) {
  const option = (value: EdgeStyle, label: string) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`rounded-full px-2.5 py-0.5 text-xs transition ${
        style === value ? "bg-gold-ink text-white" : "text-ink-warm-muted hover:text-ink-warm"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div
      className="absolute z-20 flex -translate-y-1/2 items-center gap-0.5 rounded-full border border-gold-strong bg-surface-2 p-0.5 shadow-md"
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {option("straight", "Straight")}
      {option("curved", "Curved")}
      {option("double", "S-curve")}
    </div>
  );
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

  // Local overrides below only live as long as this component -- leaving
  // Arrange (back to bloodlines, or into a book and back) remounts it from
  // the page's server props, which were fetched once on page load. So every
  // successful save re-fetches those props in place; otherwise reopening
  // the view would redraw the stale snapshot and look like nothing saved.
  function save(request: Promise<boolean>) {
    void request.then((ok) => {
      if (ok) router.refresh();
    });
  }

  // Local-only until each POST resolves -- bookId -> x. Covers both a
  // reposition of an already-placed book AND a book just dragged in from
  // the tray (computeArrangedGraph treats a bookId present here the same
  // as a real DB row, including deriving its Y fresh from its own date).
  const [placementOverrides, setPlacementOverrides] = useState<Map<number, number>>(new Map());
  const [trayGhost, setTrayGhost] = useState<{ bookId: number; title: string; coverUrl: string | null; x: number; y: number } | null>(
    null
  );

  // bookId -> edge style, same local-until-POST-resolves pattern.
  const [edgeOverrides, setEdgeOverrides] = useState<Map<number, EdgeShape>>(new Map());

  const effectiveBookPlacements = useMemo(() => {
    const merged = bookPlacements.map((p) => {
      let row = p;
      if (placementOverrides.has(p.book_id)) row = { ...row, x: placementOverrides.get(p.book_id)! };
      if (edgeOverrides.has(p.book_id)) {
        const edge = edgeOverrides.get(p.book_id)!;
        row = {
          ...row,
          edge_curved: edge.curved,
          edge_control_dx: edge.controlDx,
          edge_control_dy: edge.controlDy,
          edge_control2_dx: edge.control2Dx,
          edge_control2_dy: edge.control2Dy,
        };
      }
      return row;
    });
    for (const [bookId, x] of placementOverrides) {
      if (!merged.some((p) => p.book_id === bookId)) {
        merged.push({
          book_id: bookId,
          x,
          edge_curved: false,
          edge_control_dx: null,
          edge_control_dy: null,
          edge_control2_dx: null,
          edge_control2_dy: null,
        });
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
  const worldWidth = maxX - offsetX + PADDING;
  const worldHeight = graph.maxY - offsetY + PADDING;

  // Zoom is real layout (every world coordinate and node size multiplied
  // by it), not a CSS transform -- same reasoning as WholeTreeByDate.tsx.
  // Everything stored (x, y, edge control offsets) stays in zoom=1 world
  // units, so pointer deltas are divided by zoom before they're saved.
  const [zoom, setZoom] = useState(1);
  // Mirrors `zoom` synchronously so several wheel events landing before
  // the next render compound instead of all starting from the same value.
  const zoomRef = useRef(1);
  const pendingAnchorRef = useRef<ZoomAnchor | null>(null);
  const width = worldWidth * zoom;
  const height = worldHeight * zoom;

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
    return worldHeight > 0 ? (median - offsetY) / worldHeight : 0;
  }, [graph.nodes, offsetY, worldHeight]);

  const canvasElRef = useRef<HTMLDivElement | null>(null);
  const scrollToMedian = useCallback(
    (el: HTMLDivElement | null) => {
      canvasElRef.current = el;
      if (!el) return;
      el.scrollTop = Math.max(0, medianFrac * el.scrollHeight - el.clientHeight / 2);
    },
    [medianFrac]
  );

  // Buttons zoom around the viewport's center.
  function zoomTo(next: number) {
    const el = canvasElRef.current;
    const clamped = clampZoom(next);
    if (el) pendingAnchorRef.current = anchorAt(el, zoomRef.current, offsetX, offsetY, el.clientWidth / 2, el.clientHeight / 2);
    zoomRef.current = clamped;
    setZoom(clamped);
  }
  function zoomStep(direction: 1 | -1) {
    const current = zoomRef.current;
    const next =
      direction === 1
        ? (ZOOM_STEPS.find((s) => s > current + 0.001) ?? MAX_ZOOM)
        : ([...ZOOM_STEPS].reverse().find((s) => s < current - 0.001) ?? MIN_ZOOM);
    zoomTo(next);
  }

  // Trackpad pinch arrives as a ctrl+wheel event (Chrome/Firefox), and
  // ctrl/cmd+scroll on a mouse is the same gesture -- zoom around the
  // pointer. Needs a non-passive native listener to preventDefault the
  // browser's own page zoom; re-attached when fullscreen swaps the
  // scroll container for a new element.
  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;
    function onWheel(ev: WheelEvent) {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      const target = canvasElRef.current;
      if (!target) return;
      const current = zoomRef.current;
      const next = clampZoom(current * Math.exp(-ev.deltaY * 0.01));
      if (next === current) return;
      const rect = target.getBoundingClientRect();
      pendingAnchorRef.current = anchorAt(target, current, offsetX, offsetY, ev.clientX - rect.left, ev.clientY - rect.top);
      zoomRef.current = next;
      setZoom(next);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [offsetX, offsetY, fullscreen]);

  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    const el = canvasElRef.current;
    if (!anchor || !el) return;
    pendingAnchorRef.current = null;
    el.scrollLeft = (anchor.worldX - offsetX) * zoom + STICKY_COL_W - anchor.viewX;
    el.scrollTop = (anchor.worldY - offsetY) * zoom - anchor.viewY;
  }, [zoom, offsetX, offsetY]);

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
      liveX = startNodeX + dx / zoom;
      if (el) el.style.left = `${(liveX - offsetX) * zoom}px`;
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!dragStarted) {
        if (OPEN_BOOK_ON_TAP) router.push(`/books/${bookId}`);
        return;
      }
      setPlacementOverrides((prev) => new Map(prev).set(bookId, liveX));
      save(persistBookX(bookId, liveX));
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

      const x = (ev.clientX - rect.left + canvasEl.scrollLeft - STICKY_COL_W) / zoom + offsetX;
      setPlacementOverrides((prev) => new Map(prev).set(bookId, x));
      save(persistBookX(bookId, x));
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
      liveX = startX + dx / zoom;
      liveY = startY + dy / zoom;
      if (el) {
        el.style.left = `${(liveX - offsetX) * zoom}px`;
        el.style.top = `${(liveY - offsetY) * zoom}px`;
      }
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!dragStarted) return;
      setNodeOverrides((prev) => new Map(prev).set(nodeKey, { x: liveX, y: liveY }));
      save(persistNodeXY(nodeKey, liveX, liveY));
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // Click a line to select it: that reveals its on-line handle plus the
  // Straight/Curved toolbar. Clicking empty canvas or Escape deselects.
  const [selectedEdge, setSelectedEdge] = useState<number | null>(null);
  useEffect(() => {
    if (selectedEdge == null) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setSelectedEdge(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedEdge]);

  // Live shape while dragging an edge's handle -- a single edge
  // re-rendering per move, not the whole tree, so plain state (not a DOM
  // ref) is fine here, unlike the book/root drags above.
  const [draggingControl, setDraggingControl] = useState<{ bookId: number; shape: EdgeShape } | null>(null);

  // Dragging a handle bends the line -- on a straight line that makes it
  // curved without visiting the toolbar first. A tap without a drag just
  // selects the edge.
  function handleControlPointerDown(e: React.PointerEvent, edge: ArrangedGraph["edges"][number], handleIndex: number) {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelectedEdge(edge.bookId);
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startShape = shapeOf(edge);
    let dragStarted = false;
    let liveShape = startShape;

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      if (!dragStarted && Math.hypot(dx, dy) > DRAG_THRESHOLD) dragStarted = true;
      if (!dragStarted) return;
      liveShape = dragShape(startShape, handleIndex, dx / zoom, dy / zoom);
      setDraggingControl({ bookId: edge.bookId, shape: liveShape });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setDraggingControl(null);
      if (!dragStarted) return;
      setEdgeOverrides((prev) => new Map(prev).set(edge.bookId, liveShape));
      save(persistEdge(edge.bookId, liveShape));
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function setEdgeStyle(edge: ArrangedGraph["edges"][number], style: EdgeStyle) {
    const shape = convertShape(shapeOf(edge), style, { x: edge.x1, y: edge.y1 }, { x: edge.x2, y: edge.y2 });
    setEdgeOverrides((prev) => new Map(prev).set(edge.bookId, shape));
    save(persistEdge(edge.bookId, shape));
  }

  // World -> screen for one edge, folding in a live handle drag if one is
  // in progress. Shared by the SVG and the HTML toolbar so they agree.
  function edgeScreen(e: ArrangedGraph["edges"][number]) {
    const a = { x: (e.x1 - offsetX) * zoom, y: (e.y1 - offsetY) * zoom };
    const b = { x: (e.x2 - offsetX) * zoom, y: (e.y2 - offsetY) * zoom };
    const shape = draggingControl?.bookId === e.bookId ? draggingControl.shape : shapeOf(e);
    return { ...edgeGeometry(a, b, shape, zoom), style: edgeStyle(shape) };
  }
  const selectedEdgeData = selectedEdge == null ? null : (graph.edges.find((e) => e.bookId === selectedEdge) ?? null);

  // dateToY is a pure function of the date string alone (no dependency on
  // anything else in the dataset -- see arrangeMath.ts's frozen-epoch
  // note), so a tick's Y is just a direct call, not an interpolation.
  const yearTicks = useMemo(() => {
    if (!graph.minDate || !graph.maxDate) return [];
    const startYear = Number(graph.minDate.slice(0, 4));
    const endYear = Number(graph.maxDate.slice(0, 4));
    const ticks: { year: number; y: number }[] = [];
    for (let year = startYear; year <= endYear; year++) {
      ticks.push({ year, y: (dateToY(`${year}-01-01`) - offsetY) * zoom });
    }
    return ticks;
  }, [graph.minDate, graph.maxDate, offsetY, zoom]);

  const headerRow = (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className={`${fraunces.className} text-base font-semibold text-ink-warm`}>Arrange the tree</h2>
        <p className="mt-0.5 max-w-2xl text-xs text-ink-warm-faint">
          Drag a book to reposition it -- its row is locked to when you finished it, you control where horizontally.
          Lines are drawn from what you already told it led to; click a line, then drag its yellow handle to bend it
          around anything in the way -- or pick S-curve for two handles, or switch it back to straight.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-gold-strong bg-surface-2 px-1 py-1">
          <button
            type="button"
            onClick={() => zoomStep(-1)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            className="h-6 w-6 rounded-full text-sm text-ink-warm-muted transition hover:bg-gold-ink hover:text-white disabled:opacity-30"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => zoomTo(1)}
            title="Reset to 100%"
            className="w-10 rounded-full text-center text-xs tabular-nums text-ink-warm-muted transition hover:text-ink-warm"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => zoomStep(1)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            className="h-6 w-6 rounded-full text-sm text-ink-warm-muted transition hover:bg-gold-ink hover:text-white disabled:opacity-30"
          >
            +
          </button>
        </div>
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
      style={{ left: trayGhost.x, top: trayGhost.y, width: BOOK_W * zoom, height: BOOK_H * zoom, transform: "translate(-50%, -50%)" }}
    >
      <CoverThumb title={trayGhost.title} coverUrl={trayGhost.coverUrl} className="h-full w-full rounded shadow-lg" />
    </div>
  );

  const canvasBody = (
    <div className={`rounded-2xl border border-gold bg-surface-1 p-4 ${fullscreen ? "flex min-h-0 flex-1 flex-col" : ""}`}>
      <div ref={scrollToMedian} className={fullscreen ? "min-h-0 flex-1 overflow-auto" : "max-h-[70vh] overflow-auto"}>
        <div className="relative" style={{ width: 64 + width, height }} onPointerDown={() => setSelectedEdge(null)}>
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
              const s = edgeScreen(e);
              const selected = selectedEdge === e.bookId;
              const d = s.d;
              return (
                <g key={e.bookId} className="group">
                  <path d={d} fill="none" className={selected ? "stroke-gold-ink" : "stroke-gold-ink opacity-50"} strokeWidth={selected ? 2.5 : 1.5} />
                  {/* Wide invisible twin of the line, so it's actually
                      clickable rather than needing a pixel-perfect hit. */}
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    className="cursor-pointer"
                    style={{ pointerEvents: "stroke" }}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      setSelectedEdge(e.bookId);
                    }}
                  />
                  {/* Hover hint only -- a SELECTED edge's handles render in
                      the overlay above the covers instead (see below). */}
                  {!selected &&
                    s.handles.map((h, i) => (
                      <rect
                        key={i}
                        x={h.x - HANDLE_SIZE / 2}
                        y={h.y - HANDLE_SIZE / 2}
                        width={HANDLE_SIZE}
                        height={HANDLE_SIZE}
                        className="touch-none cursor-move fill-accent stroke-on-accent opacity-0 transition-opacity group-hover:opacity-70"
                        strokeWidth={1}
                        style={{ pointerEvents: "all" }}
                        onPointerDown={(ev) => handleControlPointerDown(ev, e, i)}
                      />
                    ))}
                </g>
              );
            })}
          </svg>
          {/* The selected edge's handles, above the cover layer: a handle
              that lands under a book cover would otherwise be ungrabbable
              (the press goes to the cover and drags the book instead).
              z-[5] keeps it under the sticky year column (z-10). */}
          {selectedEdgeData && (
            <svg className="pointer-events-none absolute left-16 top-0 z-[5] overflow-visible" style={{ width, height }}>
              {edgeScreen(selectedEdgeData).handles.map((h, i) => (
                <rect
                  key={i}
                  x={h.x - HANDLE_SIZE / 2}
                  y={h.y - HANDLE_SIZE / 2}
                  width={HANDLE_SIZE}
                  height={HANDLE_SIZE}
                  className="touch-none cursor-move fill-accent stroke-on-accent"
                  strokeWidth={1}
                  style={{ pointerEvents: "all" }}
                  onPointerDown={(ev) => handleControlPointerDown(ev, selectedEdgeData, i)}
                />
              ))}
            </svg>
          )}
          {selectedEdgeData && (
            <EdgeToolbar
              // Beside the right-most handle, so it never covers one.
              left={STICKY_COL_W + Math.max(...edgeScreen(selectedEdgeData).handles.map((h) => h.x)) + 14}
              top={edgeScreen(selectedEdgeData).handles[0].y}
              style={edgeScreen(selectedEdgeData).style}
              onChange={(style) => setEdgeStyle(selectedEdgeData, style)}
            />
          )}
          {/* pointer-events-none on the layer itself (each node opts back
              in) -- otherwise this full-canvas box sits over the SVG and
              swallows every click meant for a line or its handle. */}
          <div className="pointer-events-none absolute left-16 top-0" style={{ width, height }}>
            {graph.nodes.map((n) => {
              const left = (n.x - offsetX) * zoom;
              const top = (n.y - offsetY) * zoom;
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
                  className="pointer-events-auto absolute flex touch-none select-none flex-col items-center cursor-grab"
                  style={{ left, top, transform: "translate(-50%, -50%)" }}
                >
                  {n.kind === "book" ? (
                    <div style={{ width: BOOK_W * zoom, height: BOOK_H * zoom }} className="overflow-hidden rounded shadow-md">
                      <CoverThumb title={n.title} coverUrl={n.coverUrl} className="h-full w-full" />
                    </div>
                  ) : (
                    <div style={{ width: ROOT_SIZE * zoom, height: ROOT_SIZE * zoom, fontSize: 16 * zoom }}>
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
