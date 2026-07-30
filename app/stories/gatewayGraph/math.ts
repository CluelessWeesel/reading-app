// Turns the flat gateway_* columns on `books` into a forest: each traced
// book points at most one hop toward whatever led to it (another book, a
// person, or a source), so every weakly-connected group of >=2 nodes is
// necessarily a tree (a "bloodline") -- no book can have two gateways, and
// the DB's cycle trigger keeps book->book edges acyclic. Person/source
// nodes are always roots (they can't themselves have a gateway).

export type GatewayBookRow = {
  book_id: number;
  title: string;
  author: string | null;
  cover_url: string | null;
  genre: string | null;
  score: number | null;
  page_count: number | null;
  date_finished: string | null;
  gateway_book_id: number | null;
  gateway_person: string | null;
  gateway_source: string | null;
  gateway_checked_at: string | null;
};

// A TBR entry that already has a gateway captured -- shown greyed-out
// alongside actually-read books so the reference isn't lost between adding
// it to the list and eventually reading it. Only rows with a gateway set
// are worth showing here at all (see the query in data.ts); an entry with
// no gateway has nothing to visualize.
export type TbrGatewayRow = {
  tbr_id: number;
  title: string;
  author: string | null;
  cover_url: string | null;
  genre: string | null;
  page_count: number | null;
  created_at: string | null;
  gateway_book_id: number | null;
  gateway_person: string | null;
  gateway_source: string | null;
};

export type GraphNode =
  | {
      kind: "book";
      key: string;
      bookId: number;
      title: string;
      author: string | null;
      coverUrl: string | null;
      genre: string | null;
      score: number | null;
      pageCount: number | null;
      dateFinished: string | null;
      // TBR entries render as ordinary book nodes, just greyed out and
      // never linked to a dossier page that doesn't exist yet -- unread
      // is what the UI keys its "ever so slightly greyed out" styling off,
      // tbrAddedDate is what the chronological view positions them by
      // (when it was added to the list) since they have no dateFinished.
      unread: boolean;
      tbrAddedDate: string | null;
    }
  | { kind: "person"; key: string; name: string }
  | { kind: "source"; key: string; name: string };

export type LayoutNode = { node: GraphNode; x: number; y: number; depth: number; parentKey: string | null };
export type LayoutEdge = { fromKey: string; toKey: string; x1: number; y1: number; x2: number; y2: number };

export type Bloodline = {
  rootKey: string;
  rootLabel: string;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  size: number;
  depth: number;
  leafCount: number;
  startDate: string | null;
};

export type LeaderboardEntry = { key: string; label: string; value: number };

export type GenreBloodlineShare = { genre: string; rootLabel: string; pct: number; total: number };

export type ChainStep = { label: string; kind: GraphNode["kind"] };

export type GatewayGraphSummary = {
  totalBooks: number;
  tracedCount: number;
  untracedCount: number;
  untracedBooks: GatewayBookRow[];
  bloodlines: Bloodline[];
  orphans: (GraphNode & { kind: "book" })[];
  influentialByCount: LeaderboardEntry[];
  influentialByPages: LeaderboardEntry[];
  influentialByScore: LeaderboardEntry[];
  genreShares: GenreBloodlineShare[];
  deepestChain: { size: number; steps: ChainStep[] } | null;
  gatewayEffect: { driven: number | null; drivenCount: number; selfFound: number | null; selfFoundCount: number } | null;
  personLeaderboard: LeaderboardEntry[];
  orphanStats: { count: number; longestStandingLabel: string | null };
};

function bookKey(id: number): string {
  return `book:${id}`;
}
function personKey(name: string): string {
  return `person:${name.trim().toLowerCase()}`;
}
function sourceKey(name: string): string {
  return `source:${name.trim().toLowerCase()}`;
}

function isTraced(r: GatewayBookRow): boolean {
  return Boolean(r.gateway_checked_at || r.gateway_book_id || r.gateway_person || r.gateway_source);
}

export function nodeLabel(node: GraphNode): string {
  if (node.kind === "book") return node.title;
  return node.name;
}

export function computeGatewayGraph(rows: GatewayBookRow[], tbrRows: TbrGatewayRow[] = []): GatewayGraphSummary {
  const traced = rows.filter(isTraced);
  const untracedBooks = rows.filter((r) => !isTraced(r));

  const nodes = new Map<string, GraphNode>();
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  // Person/source keys are lowercased for grouping, but displayed using
  // whichever original casing was entered most often (free text, no
  // canonical form enforced at write time).
  const nameCounts = new Map<string, Map<string, number>>();

  function ensureNode(node: GraphNode) {
    if (!nodes.has(node.key)) {
      nodes.set(node.key, node);
      childrenOf.set(node.key, []);
    }
  }

  function registerName(key: string, raw: string) {
    const m = nameCounts.get(key) ?? new Map<string, number>();
    m.set(raw, (m.get(raw) ?? 0) + 1);
    nameCounts.set(key, m);
  }

  function displayName(key: string, fallback: string): string {
    const m = nameCounts.get(key);
    if (!m || m.size === 0) return fallback;
    let best = fallback;
    let bestCount = -1;
    for (const [raw, count] of m) {
      if (count > bestCount) {
        best = raw;
        bestCount = count;
      }
    }
    return best;
  }

  const byId = new Map(rows.map((r) => [r.book_id, r]));
  function ensureBookNode(r: GatewayBookRow) {
    ensureNode({
      kind: "book",
      key: bookKey(r.book_id),
      bookId: r.book_id,
      title: r.title,
      author: r.author,
      coverUrl: r.cover_url,
      genre: r.genre,
      score: r.score,
      pageCount: r.page_count,
      dateFinished: r.date_finished,
      unread: false,
      tbrAddedDate: null,
    });
  }

  for (const r of traced) ensureBookNode(r);

  for (const r of traced) {
    const childKey = bookKey(r.book_id);
    let parentKeyValue: string | null = null;

    if (r.gateway_book_id != null) {
      parentKeyValue = bookKey(r.gateway_book_id);
      if (!nodes.has(parentKeyValue)) {
        const target = byId.get(r.gateway_book_id);
        if (target) ensureBookNode(target);
      }
    } else if (r.gateway_person) {
      const raw = r.gateway_person.trim();
      parentKeyValue = personKey(raw);
      ensureNode({ kind: "person", key: parentKeyValue, name: raw });
      registerName(parentKeyValue, raw);
    } else if (r.gateway_source) {
      const raw = r.gateway_source.trim();
      parentKeyValue = sourceKey(raw);
      ensureNode({ kind: "source", key: parentKeyValue, name: raw });
      registerName(parentKeyValue, raw);
    }

    if (parentKeyValue && nodes.has(parentKeyValue)) {
      parentOf.set(childKey, parentKeyValue);
      childrenOf.get(parentKeyValue)!.push(childKey);
    }
  }

  // TBR entries can only ever be leaves -- gateway_book_id is a foreign key
  // into `books`, so nothing can ever cite a TBR row as ITS gateway. They
  // just hang off an existing root/book/person/source like any other leaf.
  function tbrKey(id: number): string {
    return `tbr:${id}`;
  }
  for (const r of tbrRows) {
    const childKey = tbrKey(r.tbr_id);
    let parentKeyValue: string | null = null;

    if (r.gateway_book_id != null) {
      parentKeyValue = bookKey(r.gateway_book_id);
      if (!nodes.has(parentKeyValue)) {
        const target = byId.get(r.gateway_book_id);
        if (target) ensureBookNode(target);
      }
    } else if (r.gateway_person) {
      const raw = r.gateway_person.trim();
      parentKeyValue = personKey(raw);
      ensureNode({ kind: "person", key: parentKeyValue, name: raw });
      registerName(parentKeyValue, raw);
    } else if (r.gateway_source) {
      const raw = r.gateway_source.trim();
      parentKeyValue = sourceKey(raw);
      ensureNode({ kind: "source", key: parentKeyValue, name: raw });
      registerName(parentKeyValue, raw);
    }

    if (!parentKeyValue || !nodes.has(parentKeyValue)) continue;

    ensureNode({
      kind: "book",
      key: childKey,
      bookId: -r.tbr_id,
      title: r.title,
      author: r.author,
      coverUrl: r.cover_url,
      genre: r.genre,
      score: null,
      pageCount: r.page_count,
      dateFinished: null,
      unread: true,
      tbrAddedDate: r.created_at,
    });
    parentOf.set(childKey, parentKeyValue);
    childrenOf.get(parentKeyValue)!.push(childKey);
  }

  // Resolve display names for person/source nodes now that all citations
  // are counted.
  for (const [key, node] of nodes) {
    if (node.kind !== "book") nodes.set(key, { ...node, name: displayName(key, node.name) });
  }

  function findRoot(key: string): string {
    let cur = key;
    const seen = new Set<string>();
    while (parentOf.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = parentOf.get(cur)!;
    }
    return cur;
  }

  function labelOf(key: string): string {
    return nodeLabel(nodes.get(key)!);
  }

  const rootKeys = [...nodes.keys()].filter((k) => !parentOf.has(k) && childrenOf.get(k)!.length > 0);

  const bloodlines: Bloodline[] = rootKeys.map((rootKey) => buildBloodline(rootKey, nodes, parentOf, childrenOf));
  bloodlines.sort((a, b) => b.size - a.size);

  const orphans = [...nodes.values()].filter(
    (n): n is GraphNode & { kind: "book" } => n.kind === "book" && !parentOf.has(n.key) && childrenOf.get(n.key)!.length === 0
  );

  // Every node with >=1 child is a candidate for the influence leaderboards,
  // not just bloodline roots -- an interior book (e.g. book 2 of a series
  // someone else picked up because of it) is influential in its own right.
  const internalKeys = [...nodes.keys()].filter((k) => childrenOf.get(k)!.length > 0);

  function descendants(key: string): (GraphNode & { kind: "book" })[] {
    const out: (GraphNode & { kind: "book" })[] = [];
    for (const childKey of childrenOf.get(key) ?? []) {
      const child = nodes.get(childKey)!;
      if (child.kind === "book") out.push(child);
      out.push(...descendants(childKey));
    }
    return out;
  }

  const influentialByCount: LeaderboardEntry[] = internalKeys
    .map((key) => ({ key, label: labelOf(key), value: descendants(key).length }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const influentialByPages: LeaderboardEntry[] = internalKeys
    .map((key) => ({ key, label: labelOf(key), value: descendants(key).reduce((sum, d) => sum + (d.pageCount ?? 0), 0) }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const influentialByScore: LeaderboardEntry[] = internalKeys
    .map((key) => ({
      key,
      label: labelOf(key),
      value: descendants(key).reduce((sum, d) => sum + (d.score ?? 0), 0),
    }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const personLeaderboard: LeaderboardEntry[] = internalKeys
    .filter((k) => nodes.get(k)!.kind === "person")
    .map((key) => ({ key, label: labelOf(key), value: descendants(key).length }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Reading bloodlines by genre: for each genre with enough traced books,
  // does one bloodline dominate where the genre's reading came from?
  const genreTotals = new Map<string, number>();
  const genreRootCounts = new Map<string, Map<string, number>>();
  for (const r of traced) {
    if (!r.genre) continue;
    genreTotals.set(r.genre, (genreTotals.get(r.genre) ?? 0) + 1);
    const rootKey = findRoot(bookKey(r.book_id));
    const m = genreRootCounts.get(r.genre) ?? new Map<string, number>();
    m.set(rootKey, (m.get(rootKey) ?? 0) + 1);
    genreRootCounts.set(r.genre, m);
  }
  const genreShares: GenreBloodlineShare[] = [...genreTotals.entries()]
    .filter(([, total]) => total >= 3)
    .map(([genre, total]) => {
      const rootCounts = genreRootCounts.get(genre)!;
      let bestRoot = "";
      let bestCount = 0;
      for (const [rootKey, count] of rootCounts) {
        if (count > bestCount) {
          bestRoot = rootKey;
          bestCount = count;
        }
      }
      return { genre, rootLabel: labelOf(bestRoot), pct: bestCount / total, total };
    })
    .filter((s) => s.pct * s.total >= 2)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  // Deepest unbroken chain: longest root-to-leaf path across the whole forest.
  let deepestChain: GatewayGraphSummary["deepestChain"] = null;
  for (const bloodline of bloodlines) {
    for (const leaf of bloodline.nodes) {
      if (childrenOf.get(leaf.node.key)!.length > 0) continue; // only leaves
      const path: string[] = [];
      let cur: string | undefined = leaf.node.key;
      while (cur) {
        path.push(cur);
        cur = parentOf.get(cur);
      }
      if (!deepestChain || path.length > deepestChain.size) {
        const steps: ChainStep[] = path.map((key) => {
          const node = nodes.get(key)!;
          if (node.kind === "book") return { label: node.title, kind: node.kind };
          // Year attributed = earliest finish date among books citing this person/source directly.
          const years = (childrenOf.get(key) ?? [])
            .map((childKey) => nodes.get(childKey))
            .filter((n): n is GraphNode & { kind: "book" } => n?.kind === "book" && Boolean(n.dateFinished))
            .map((n) => n.dateFinished!.slice(0, 4));
          const year = years.length > 0 ? years.sort()[0] : null;
          return { label: year ? `${node.name}, ${year}` : node.name, kind: node.kind };
        });
        deepestChain = { size: path.length, steps };
      }
    }
  }

  // Gateway effect: average score of books with a traced gateway vs. books
  // explicitly marked "found it myself".
  let drivenSum = 0;
  let drivenCount = 0;
  let selfSum = 0;
  let selfCount = 0;
  for (const r of traced) {
    if (r.score == null) continue;
    const hasGateway = r.gateway_book_id != null || Boolean(r.gateway_person) || Boolean(r.gateway_source);
    if (hasGateway) {
      drivenSum += r.score;
      drivenCount += 1;
    } else {
      selfSum += r.score;
      selfCount += 1;
    }
  }
  const gatewayEffect =
    drivenCount > 0 || selfCount > 0
      ? {
          driven: drivenCount > 0 ? drivenSum / drivenCount : null,
          drivenCount,
          selfFound: selfCount > 0 ? selfSum / selfCount : null,
          selfFoundCount: selfCount,
        }
      : null;

  const longestStandingOrphan = orphans
    .filter((o) => o.dateFinished)
    .sort((a, b) => (a.dateFinished! < b.dateFinished! ? -1 : 1))[0];

  return {
    totalBooks: rows.length,
    tracedCount: traced.length,
    untracedCount: untracedBooks.length,
    untracedBooks,
    bloodlines,
    orphans,
    influentialByCount,
    influentialByPages,
    influentialByScore,
    genreShares,
    deepestChain,
    gatewayEffect,
    personLeaderboard,
    orphanStats: {
      count: orphans.length,
      longestStandingLabel: longestStandingOrphan
        ? `${longestStandingOrphan.title}, ${longestStandingOrphan.dateFinished!.slice(0, 4)}`
        : null,
    },
  };
}

function buildBloodline(
  rootKey: string,
  nodes: Map<string, GraphNode>,
  parentOf: Map<string, string>,
  childrenOf: Map<string, string[]>
): Bloodline {
  const keysInTree: string[] = [];
  (function collect(key: string) {
    keysInTree.push(key);
    (childrenOf.get(key) ?? []).forEach(collect);
  })(rootKey);

  let startDate: string | null = null;
  for (const key of keysInTree) {
    const node = nodes.get(key)!;
    const d = node.kind === "book" ? (node.dateFinished ?? (node.unread ? node.tbrAddedDate : null)) : null;
    if (d && (!startDate || d < startDate)) startDate = d;
  }

  // Purely structural layout: y is which generation a node is (even rows),
  // x is leaf order -- NOT when it was actually read. A real gap of a year
  // and a half between a book and its gateway (not rare -- a series picked
  // back up much later) would otherwise stretch that one edge across
  // almost the entire canvas while everything else bunches into a sliver,
  // making the connection unreadable. Clean and legible beats "accurate
  // timeline"; date info is still there in "the whole tree, by date" and
  // the deepest-chain caption, just not driving where things sit.
  let leafCounter = 0;
  const xOf = new Map<string, number>();
  const depthOf = new Map<string, number>();
  let maxDepth = 0;

  function assignX(key: string, depth: number): number {
    depthOf.set(key, depth);
    maxDepth = Math.max(maxDepth, depth);
    const kids = childrenOf.get(key) ?? [];
    if (kids.length === 0) {
      const x = leafCounter;
      leafCounter += 1;
      xOf.set(key, x);
      return x;
    }
    const childXs = kids.map((k) => assignX(k, depth + 1));
    const x = childXs.reduce((a, b) => a + b, 0) / childXs.length;
    xOf.set(key, x);
    return x;
  }
  assignX(rootKey, 0);

  const totalLeaves = Math.max(leafCounter, 1);
  const toFrac = (x: number) => (totalLeaves <= 1 ? 0.5 : x / (totalLeaves - 1));
  const toY = (key: string) => (maxDepth === 0 ? 0.5 : depthOf.get(key)! / maxDepth);

  const layoutNodes: LayoutNode[] = [];
  const layoutEdges: LayoutEdge[] = [];

  for (const key of keysInTree) {
    const x = toFrac(xOf.get(key)!);
    const y = toY(key);
    const node = nodes.get(key)!;
    const parentKeyValue = parentOf.get(key) ?? null;
    layoutNodes.push({ node, x, y, depth: depthOf.get(key)!, parentKey: parentKeyValue });
    if (parentKeyValue) {
      const px = toFrac(xOf.get(parentKeyValue)!);
      const py = toY(parentKeyValue);
      layoutEdges.push({ fromKey: key, toKey: parentKeyValue, x1: px, y1: py, x2: x, y2: y });
    }
  }

  return {
    rootKey,
    rootLabel: nodeLabel(nodes.get(rootKey)!),
    nodes: layoutNodes,
    edges: layoutEdges,
    size: keysInTree.length,
    depth: maxDepth,
    leafCount: totalLeaves,
    startDate,
  };
}

// Overrides y (only y -- x/leaf order is untouched) with a position on one
// shared calendar shared by every bloodline passed in, for "the whole tree,
// by date" -- unlike the focused single-bloodline view (kept structural on
// purpose: one bloodline's own outlier gap shouldn't crush its own
// readability), here the whole point is a true timeline, so bloodlines are
// expected to interleave and tangle where their real reading overlapped.
// A book uses its own date_finished; a person/source root (no date of its
// own) or an undated book uses the earliest dated book anywhere below it,
// so it still sits just above where its influence actually starts.
//
// Pure linear time was tried first and produced a canvas that was mostly
// empty: a single multi-month lull ate as much vertical space as months of
// dense reading. Gaps between consecutive dated days are compressed with
// sqrt before accumulating, so a 400-day gap costs ~20x a 1-day gap instead
// of 400x -- order and "this was a longer pause" both survive, but idle
// calendar time stops being the thing that decides the canvas's size.
export type ChronologicalLayout = {
  bloodlines: Bloodline[];
  minDate: string | null;
  maxDate: string | null;
  // Same warped (not linear) scale used for node y -- callers positioning
  // anything else on this timeline (year gridlines) should use this so
  // they land where the nodes actually are.
  warpedFraction: (isoDate: string) => number;
  // Total accumulated warped units across the whole dataset, for sizing
  // the canvas (in place of raw elapsed days).
  warpedSpan: number;
};

export function layoutBloodlinesChronologically(bloodlines: Bloodline[]): ChronologicalLayout {
  const allDates: number[] = [];
  for (const b of bloodlines) {
    for (const n of b.nodes) {
      if (n.node.kind !== "book") continue;
      const d = n.node.dateFinished ?? (n.node.unread ? n.node.tbrAddedDate : null);
      if (d) allDates.push(Date.parse(d));
    }
  }
  if (allDates.length < 2) {
    return { bloodlines, minDate: null, maxDate: null, warpedFraction: () => 0.5, warpedSpan: 0 };
  }
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  if (maxDate <= minDate) {
    return { bloodlines, minDate: null, maxDate: null, warpedFraction: () => 0.5, warpedSpan: 0 };
  }

  const sortedUnique = [...new Set(allDates)].sort((a, b) => a - b);
  const breakpoints: { t: number; cum: number }[] = [{ t: sortedUnique[0], cum: 0 }];
  let cum = 0;
  for (let i = 1; i < sortedUnique.length; i++) {
    cum += Math.sqrt((sortedUnique[i] - sortedUnique[i - 1]) / 86400000);
    breakpoints.push({ t: sortedUnique[i], cum });
  }
  const totalWarped = cum || 1;

  function warpedFractionMs(t: number): number {
    if (t <= breakpoints[0].t) return 0;
    const last = breakpoints[breakpoints.length - 1];
    if (t >= last.t) return 1;
    for (let i = 1; i < breakpoints.length; i++) {
      if (t <= breakpoints[i].t) {
        const lo = breakpoints[i - 1];
        const hi = breakpoints[i];
        const segFrac = hi.t === lo.t ? 0 : (t - lo.t) / (hi.t - lo.t);
        return (lo.cum + segFrac * (hi.cum - lo.cum)) / totalWarped;
      }
    }
    return 1;
  }

  const globalY = (t: number) => warpedFractionMs(t);

  const remapped = bloodlines.map((b) => {
    const byKey = new Map(b.nodes.map((n) => [n.node.key, n]));
    const childrenOf = new Map<string, string[]>();
    for (const n of b.nodes) {
      if (n.parentKey) childrenOf.set(n.parentKey, [...(childrenOf.get(n.parentKey) ?? []), n.node.key]);
    }

    function earliestDescendantDate(key: string): number | null {
      const n = byKey.get(key)!.node;
      if (n.kind === "book" && n.dateFinished) return Date.parse(n.dateFinished);
      if (n.kind === "book" && n.unread && n.tbrAddedDate) return Date.parse(n.tbrAddedDate);
      let best: number | null = null;
      for (const childKey of childrenOf.get(key) ?? []) {
        const d = earliestDescendantDate(childKey);
        if (d != null && (best == null || d < best)) best = d;
      }
      return best;
    }

    const yOf = new Map<string, number>();
    for (const n of b.nodes) {
      const t = earliestDescendantDate(n.node.key);
      yOf.set(n.node.key, t != null ? globalY(t) : n.y);
    }

    return {
      ...b,
      nodes: b.nodes.map((n) => ({ ...n, y: yOf.get(n.node.key)! })),
      edges: b.edges.map((e) => ({ ...e, y1: yOf.get(e.toKey)!, y2: yOf.get(e.fromKey)! })),
    };
  });

  return {
    bloodlines: remapped,
    minDate: new Date(minDate).toISOString().slice(0, 10),
    maxDate: new Date(maxDate).toISOString().slice(0, 10),
    warpedFraction: (isoDate: string) => warpedFractionMs(Date.parse(isoDate)),
    warpedSpan: totalWarped,
  };
}
