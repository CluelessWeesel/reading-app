"use client";

import { useCallback, useMemo, useState } from "react";
import { fraunces } from "../../shared/fonts";
import { BloodlineTree } from "./BloodlineTree";
import { layoutBloodlinesChronologically, type Bloodline } from "./math";

const BASE_PX_PER_WARPED_UNIT = 14;
const BASE_NODE_SIZE = 200; // was 40 (x5)
// Node-to-node gap, not a naive x5 of the old 46 -- that would have kept
// the old ratio's loose ~73%-of-node-width gap. Derived from the new node
// size instead, at a tight ~20% gap.
const BASE_PX_PER_LEAF = ((BASE_NODE_SIZE * 2) / 3) * 1.2;
const BASE_LANE_GAP = BASE_NODE_SIZE * 0.5; // same 0.5x-of-node-size ratio as the old 20/40
const ZOOM_STEPS = [0.2, 0.35, 0.6, 0.8, 1, 1.25, 1.5, 2, 2.5];
// Fixed-size text (text-[11px], not zoom-scaled like nodes are), so this
// stays a flat pixel reserve regardless of zoom -- covers the label's own
// line height plus its pb-1 gap above the root avatar.
const LABEL_RESERVE_PX = 24;

export function WholeTreeByDate({ bloodlines, onClose }: { bloodlines: Bloodline[]; onClose: () => void }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(ZOOM_STEPS.indexOf(1));
  const zoom = ZOOM_STEPS[zoomIndex];

  const undated = useMemo(() => bloodlines.filter((b) => !b.startDate), [bloodlines]);

  // One shared calendar for every bloodline -- deliberately not siloed into
  // separate per-year boxes anymore. Bloodlines that actually overlapped in
  // real life will visually tangle here on purpose; that's the point of
  // this view (the focused single-bloodline view stays structural/clean).
  const {
    bloodlines: dated,
    minDate,
    maxDate,
    warpedFraction,
    warpedSpan,
  } = useMemo(() => layoutBloodlinesChronologically(bloodlines.filter((b) => b.startDate)), [bloodlines]);

  // Zoom is real layout (bigger pixel values), not a CSS transform -- a
  // transform on an ancestor breaks position:sticky for the year column
  // (well-known CSS trap: it changes the sticky element's containing
  // block), which took real effort to get working in the first place.
  const height = Math.max(500, warpedSpan * BASE_PX_PER_WARPED_UNIT * zoom);
  const pxPerLeaf = BASE_PX_PER_LEAF * zoom;
  const laneGap = BASE_LANE_GAP * zoom;
  const nodeSize = BASE_NODE_SIZE * zoom;
  // EDGE_MARGIN (in math.ts) only ever reserved room for a node's own
  // half-size -- never for the root label floating above it on top of
  // that. At low zoom, `height` sits on its 500px floor while the label's
  // text stays a fixed 11px, so that margin can be barely enough for the
  // avatar alone and leave nothing for the label (confirmed: it wasn't).
  // Reserving real pixel space here, on top of the existing height rather
  // than inside it, guarantees the room exists regardless of zoom or how
  // short the dataset's date range is.
  const topInsetPx = nodeSize / 2 + LABEL_RESERVE_PX;

  const lanes = useMemo(
    () =>
      dated.reduce<{ bloodline: Bloodline; x0: number; width: number; rootY: number }[]>((acc, b) => {
        // leafCount * pxPerLeaf alone sizes a lane for its *book* covers
        // only (nodeSize * 2/3 wide each, see BloodlineTree's boxSize) --
        // but the root avatar renders at the full nodeSize, noticeably
        // wider than a book. For a sparse lane (most acutely leafCount===1,
        // where this floor is the only term that can ever win) that left
        // the root avatar wider than its own lane by a fixed proportion,
        // at every zoom level -- zooming in/out scales both numbers
        // together, so it never actually fixed itself.
        const width = Math.max(80 * zoom, nodeSize * 1.2, b.leafCount * pxPerLeaf);
        const rootY = b.nodes.find((n) => n.node.key === b.rootKey)?.y ?? 0;
        const prevEnd = acc.length > 0 ? acc[acc.length - 1].x0 + acc[acc.length - 1].width + laneGap : 0;
        acc.push({ bloodline: b, x0: prevEnd, width, rootY });
        return acc;
      }, []),
    [dated, pxPerLeaf, laneGap, zoom, nodeSize]
  );

  const totalWidth = lanes.length > 0 ? lanes[lanes.length - 1].x0 + lanes[lanes.length - 1].width : 0;

  // The canvas opens scrolled to wherever the median node sits, not to the
  // top -- a real, serious bug caught in testing: the top of the timeline
  // is exactly where reading was sparsest (that's why it's the top), so
  // opening there landed on a box that looked completely blank with no
  // hint that scrolling would ever reveal anything. Centering on the
  // median guarantees at least half of everything is close by, regardless
  // of how the data happens to be distributed.
  const medianFrac = useMemo(() => {
    const ys: number[] = [];
    for (const b of dated) for (const n of b.nodes) ys.push(n.y);
    if (ys.length === 0) return 0.5;
    ys.sort((a, b) => a - b);
    return ys[Math.floor(ys.length / 2)];
  }, [dated]);

  const scrollToMedian = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      el.scrollTop = Math.max(0, medianFrac * el.scrollHeight - el.clientHeight / 2);
    },
    [medianFrac]
  );

  const yearTicks = useMemo(() => {
    if (!minDate || !maxDate) return [];
    const startYear = Number(minDate.slice(0, 4));
    const endYear = Number(maxDate.slice(0, 4));
    const ticks: { year: number; frac: number }[] = [];
    for (let y = startYear; y <= endYear; y++) {
      ticks.push({ year: y, frac: warpedFraction(`${y}-01-01`) });
    }
    return ticks;
  }, [minDate, maxDate, warpedFraction]);

  function handleClose() {
    setFullscreen(false);
    onClose();
  }

  const headerRow = (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className={`${fraunces.className} text-base font-semibold text-ink-warm`}>The whole tree, by date</h2>
        <p className="mt-0.5 max-w-2xl text-xs text-ink-warm-faint">
          One shared timeline for everything -- bloodlines that overlapped in real life tangle together here. Hover
          any node to trace what it led to. TBR books you&apos;ve already picked a gateway for show up too, greyed
          out, so the reference isn&apos;t lost by the time you get to them.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-1 rounded-full border border-gold-strong bg-surface-2 px-1 py-1">
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
            className="h-6 w-6 rounded-full text-sm text-ink-warm-muted transition hover:bg-gold-ink hover:text-white disabled:opacity-30"
          >
            −
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-ink-warm-muted">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
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
          onClick={handleClose}
          className="whitespace-nowrap rounded-full border border-gold-strong bg-surface-2 px-3.5 py-1.5 text-xs text-ink-warm-muted transition hover:bg-gold-ink hover:text-white"
        >
          ← Back to bloodlines
        </button>
      </div>
    </div>
  );

  const canvasBody =
    lanes.length === 0 ? (
      <p className="rounded-2xl border border-gold bg-surface-1 px-5 py-10 text-center text-sm text-ink-warm-faint">
        Nothing dated yet.
      </p>
    ) : (
      <div className={`rounded-2xl border border-gold bg-surface-1 p-4 ${fullscreen ? "flex min-h-0 flex-1 flex-col" : ""}`}>
        {/* One shared scroll box for both axes, not a split tick-column /
            canvas pair each managing their own overflow -- tried that
            (overflow-x-auto with overflow-y-hidden or -clip on the
            canvas) and it created a dead zone where the mouse wheel did
            nothing while hovered over it, because a container that can
            only scroll on one axis doesn't reliably chain the other axis
            to the page (confirmed by hand; -clip fell back to -hidden in
            this browser, same bug). A single bounded overflow-auto box
            has no such ambiguity. The tick column stays put horizontally
            via `sticky` while still scrolling vertically with everything
            else, since it's the same scroll container. */}
        <div ref={scrollToMedian} className={fullscreen ? "min-h-0 flex-1 overflow-auto" : "max-h-[70vh] overflow-auto"}>
          {/* The sticky tick column needs its DIRECT parent to span the
              entire scrollable width, not just its own 64px -- as a CSS
              grid track sized to exactly 64px, it had zero "slack" to
              stay put while the track (and everything sticky inside it)
              scrolled away with the rest of the grid. Plain relative
              width here instead of a grid gives it room to actually stick. */}
          <div className="relative" style={{ width: 64 + totalWidth, height: height + topInsetPx }}>
            <div className="sticky left-0 z-10 h-full w-16 bg-surface-1">
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gold-strong" />
              {yearTicks.map((t) => (
                <div
                  key={t.year}
                  className="absolute left-0 right-0 flex -translate-y-1/2 flex-col items-center"
                  style={{ top: topInsetPx + t.frac * height }}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-gold-ink shadow-[0_0_0_4px_var(--surface-1)]" />
                  <span className="mt-1 text-xs font-bold text-ink-warm-muted">{t.year}</span>
                </div>
              ))}
            </div>

            <div className="absolute" style={{ left: 64, top: topInsetPx, width: totalWidth, height }}>
              {yearTicks.map((t) => (
                <div
                  key={t.year}
                  className="absolute left-0 right-0 border-t border-dashed border-gold opacity-40"
                  style={{ top: `${t.frac * 100}%` }}
                />
              ))}
              {lanes.map(({ bloodline: b, x0, width, rootY }) => (
                <div key={b.rootKey} className="absolute top-0" style={{ left: x0, width, height }}>
                  {/* rootY% is the root's CENTER (BloodlineTree centers every
                      node on its coordinate via translate(-50%,-50%)), not
                      its top edge -- positioning the label flush at rootY%
                      put its bottom edge on the circle's center, so the
                      avatar's own top half (painted after this span in the
                      DOM) covered the label's bottom half. Subtract the
                      node's own half-height, in real pixels, to actually
                      clear its top edge. */}
                  <span
                    className="absolute left-1/2 -translate-x-1/2 -translate-y-full truncate pb-1 text-[11px] text-ink-warm-faint"
                    style={{ top: rootY * height - nodeSize / 2, maxWidth: width }}
                  >
                    <b className="text-ink-warm">{b.rootLabel}</b> · {b.size}
                  </span>
                  <BloodlineTree bloodline={b} variant="preview" mode="static" nodeSizeOverride={nodeSize} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-paper px-4 py-4 sm:px-8 sm:py-6">
        {headerRow}
        {canvasBody}
      </div>
    );
  }

  return (
    <div>
      {headerRow}
      {canvasBody}
      {undated.length > 0 && (
        <p className="mt-3 text-xs text-ink-warm-faint">
          {undated.length} bloodline{undated.length === 1 ? "" : "s"} with no dated books, not shown above.
        </p>
      )}
    </div>
  );
}
