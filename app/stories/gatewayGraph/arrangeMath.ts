import type { Bloodline, GatewayGraphSummary } from "./math";

// Frozen epoch + scale -- a given date_finished must map to the exact same
// pixel forever, since Y is never stored (only X is). Changing either
// constant relocates every already-manually-placed book relative to
// whatever X it was dragged to, which can reintroduce overlaps the user
// had already dragged apart -- treat a change here with the same care as
// an irreversible migration. 2015-01-01 is a round date safely before the
// real earliest date_finished in the data (2020-01-22 as of writing).
//
// Deliberately NOT layoutBloodlinesChronologically's sqrt-warp (math.ts) --
// that function is relative and dataset-dependent (it compresses gaps
// between whatever dates currently exist, recomputed fresh every render),
// which is wrong here: adding one new book could shift its warp breakpoints
// and silently reshuffle every already-placed book's Y, reintroducing
// overlaps a user had manually dragged apart. This is a different,
// absolute transform solving a different problem, not a risk-averse copy.
const EPOCH_MS = Date.parse("2015-01-01T00:00:00Z");
const PX_PER_SQRT_DAY = 40;

function daysSinceEpoch(dateIso: string): number {
  return (Date.parse(`${dateIso}T00:00:00Z`) - EPOCH_MS) / 86_400_000;
}

export function dateToY(dateIso: string): number {
  const days = Math.max(0, daysSinceEpoch(dateIso));
  return Math.sqrt(days) * PX_PER_SQRT_DAY;
}

// A book's own date_finished if it has one; otherwise (a currently-reading
// book that's already gateway-tagged) the earliest date_finished anywhere
// in its own subtree -- same fallback idea the old chronological layout
// used for root nodes, reimplemented fresh here (see the isolation note
// above), and deliberately ignoring tbrAddedDate -- a TBR "date added"
// isn't a read date and TBR leaves aren't part of this view at all.
export function earliestDateInSubtree(bloodline: Bloodline, key: string): string | null {
  const byKey = new Map(bloodline.nodes.map((n) => [n.node.key, n]));
  const childrenOf = new Map<string, string[]>();
  for (const n of bloodline.nodes) {
    if (n.parentKey) childrenOf.set(n.parentKey, [...(childrenOf.get(n.parentKey) ?? []), n.node.key]);
  }

  function walk(k: string): string | null {
    const node = byKey.get(k)?.node;
    if (node?.kind === "book" && node.dateFinished) return node.dateFinished;
    let best: string | null = null;
    for (const childKey of childrenOf.get(k) ?? []) {
      const d = walk(childKey);
      if (d && (!best || d < best)) best = d;
    }
    return best;
  }

  return walk(key);
}

// Row shapes matching book_graph_placement / gateway_node_placement
// (0034_gateway_tree_placement.sql) -- owned here, not data.ts, same
// convention as math.ts owning GatewayBookRow/TbrGatewayRow for data.ts to
// just return.
export type BookPlacementRow = {
  book_id: number;
  x: number;
  edge_curved: boolean;
  edge_control_dx: number | null;
  edge_control_dy: number | null;
};
export type NodePlacementRow = { node_key: string; x: number; y: number };

export type ArrangedBookNode = {
  kind: "book";
  key: string;
  bookId: number;
  title: string;
  author: string | null;
  coverUrl: string | null;
  x: number;
  y: number;
};
export type ArrangedRootNode = { kind: "person" | "source"; key: string; name: string; x: number; y: number };
export type ArrangedNode = ArrangedBookNode | ArrangedRootNode;

export type ArrangedEdge = {
  // Styling lives on the CHILD book's own placement row -- a person/source
  // node can never have an outgoing edge (it can't have a gateway).
  bookId: number;
  fromKey: string;
  toKey: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  curved: boolean;
  controlDx: number | null;
  controlDy: number | null;
};

export type TrayBook = {
  bookId: number;
  key: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  dateFinished: string | null;
};

export type ArrangedGraph = {
  nodes: ArrangedNode[];
  edges: ArrangedEdge[];
  tray: TrayBook[];
  minY: number;
  maxY: number;
  // ISO dates behind minY/maxY -- for year-gridline rendering, so the
  // caller never needs to invert dateToY itself.
  minDate: string | null;
  maxDate: string | null;
};

// Assembles the drag-to-arrange canvas from the SAME summary the other
// three views already compute (computeGatewayGraph is pure/stable, safe to
// reuse) plus the two placement tables -- but builds its own flat node/edge
// list rather than reusing Bloodline.nodes' own x/y (those are the
// structural/chronological fractions from the OTHER views' layout, not
// relevant here). A book with no placement row goes to the tray instead of
// rendering; an edge only renders when BOTH endpoints are placed.
export function computeArrangedGraph(
  summary: GatewayGraphSummary,
  bookPlacements: BookPlacementRow[],
  nodePlacements: NodePlacementRow[]
): ArrangedGraph {
  const placementByBookId = new Map(bookPlacements.map((p) => [p.book_id, p]));
  const placementByNodeKey = new Map(nodePlacements.map((p) => [p.node_key, p]));

  const nodes: ArrangedNode[] = [];
  const edges: ArrangedEdge[] = [];
  const tray: TrayBook[] = [];
  const positionByKey = new Map<string, { x: number; y: number }>();
  let minDate: string | null = null;
  let maxDate: string | null = null;

  // Pass 1: place every node that has a placement row (roots don't depend
  // on anything computed here, so they're safe to resolve first).
  for (const bloodline of summary.bloodlines) {
    for (const layoutNode of bloodline.nodes) {
      const { node } = layoutNode;
      if (node.kind === "book") {
        if (node.unread) continue; // TBR leaves aren't part of this view
        const placement = placementByBookId.get(node.bookId);
        if (!placement) {
          tray.push({ bookId: node.bookId, key: node.key, title: node.title, author: node.author, coverUrl: node.coverUrl, dateFinished: node.dateFinished });
          continue;
        }
        const dateIso = node.dateFinished ?? earliestDateInSubtree(bloodline, node.key);
        if (!dateIso) continue; // no date anywhere in its subtree -- can't place on the Y axis yet
        const y = dateToY(dateIso);
        positionByKey.set(node.key, { x: placement.x, y });
        nodes.push({ kind: "book", key: node.key, bookId: node.bookId, title: node.title, author: node.author, coverUrl: node.coverUrl, x: placement.x, y });
        if (!minDate || dateIso < minDate) minDate = dateIso;
        if (!maxDate || dateIso > maxDate) maxDate = dateIso;
      } else {
        const placement = placementByNodeKey.get(node.key);
        if (!placement) continue; // unplaced root -- no tray for these in v1, simply not rendered yet
        positionByKey.set(node.key, { x: placement.x, y: placement.y });
        nodes.push({ kind: node.kind, key: node.key, name: node.name, x: placement.x, y: placement.y });
      }
    }
  }

  // Pass 2: edges, now that every placed node's position is known.
  for (const bloodline of summary.bloodlines) {
    for (const layoutNode of bloodline.nodes) {
      const { node, parentKey } = layoutNode;
      if (node.kind !== "book" || node.unread || !parentKey) continue;
      const childPos = positionByKey.get(node.key);
      const parentPos = positionByKey.get(parentKey);
      if (!childPos || !parentPos) continue; // one or both ends not placed yet
      const placement = placementByBookId.get(node.bookId)!; // guaranteed: childPos only exists if placement existed
      edges.push({
        bookId: node.bookId,
        fromKey: node.key,
        toKey: parentKey,
        x1: childPos.x,
        y1: childPos.y,
        x2: parentPos.x,
        y2: parentPos.y,
        curved: placement.edge_curved,
        controlDx: placement.edge_control_dx,
        controlDy: placement.edge_control_dy,
      });
    }
  }

  tray.sort((a, b) => (a.dateFinished ?? "9999-99-99").localeCompare(b.dateFinished ?? "9999-99-99"));

  const ys = nodes.map((n) => n.y);
  const minY = ys.length > 0 ? Math.min(...ys) : 0;
  const maxY = ys.length > 0 ? Math.max(...ys) : 0;

  return { nodes, edges, tray, minY, maxY, minDate, maxDate };
}
