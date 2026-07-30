"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import { coverGradient } from "../../shared/coverPalette";
import type { Bloodline, GraphNode } from "./math";
import { nodeLabel } from "./math";

function RootAvatar({ name, className }: { name: string; className: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br shadow-sm ring-2 ring-gold-ink ${coverGradient(
        name
      )} ${className}`}
    >
      <span className={`${fraunces.className} font-semibold text-black/30 dark:text-white/30`}>{name.charAt(0)}</span>
    </div>
  );
}

type Mode =
  | "static" // grid preview thumbnail -- no per-node interaction, the whole card is the click target
  | "explore" // book nodes link out to their dossier
  | "trace"; // clicking any node selects it as the traced leaf (see dimKeys/selectedKey/onSelectNode)

// Percentage-coordinate SVG + absolutely-positioned nodes over it.
export function BloodlineTree({
  bloodline,
  variant,
  mode,
  dimKeys,
  selectedKey,
  onSelectNode,
  nodeSizeOverride,
}: {
  bloodline: Bloodline;
  variant: "preview" | "focused";
  mode: Mode;
  // When set, nodes/edges NOT in this set are rendered dim (trace mode).
  dimKeys?: Set<string> | null;
  selectedKey?: string | null;
  onSelectNode?: (node: GraphNode) => void;
  // Overrides the variant's default node size -- e.g. "the whole tree, by
  // date" wants bigger covers than the small grid-card previews.
  nodeSizeOverride?: number;
}) {
  const nodeSize = nodeSizeOverride ?? (variant === "preview" ? 26 : 36);
  const rootSize = nodeSize;
  const traceMode = mode === "trace";

  // Hovering any node highlights everything downstream of it -- for a root
  // that's the whole bloodline, for an interior book it's just what came
  // after. Trace mode has its own click-driven (upstream, ancestor-path)
  // dimming with different semantics, so hover sits out there to avoid
  // showing two different kinds of highlight in the same view.
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const hoverEnabled = mode !== "trace";

  const descendantsOf = useMemo(() => {
    const childrenOf = new Map<string, string[]>();
    for (const n of bloodline.nodes) {
      if (n.parentKey) childrenOf.set(n.parentKey, [...(childrenOf.get(n.parentKey) ?? []), n.node.key]);
    }
    return (key: string): Set<string> => {
      const out = new Set<string>([key]);
      const stack = [...(childrenOf.get(key) ?? [])];
      while (stack.length > 0) {
        const k = stack.pop()!;
        if (out.has(k)) continue;
        out.add(k);
        stack.push(...(childrenOf.get(k) ?? []));
      }
      return out;
    };
  }, [bloodline]);

  const effectiveDim = dimKeys ?? (hoverEnabled && hoverKey ? descendantsOf(hoverKey) : null);
  const nodeByKey = useMemo(() => new Map(bloodline.nodes.map((n) => [n.node.key, n.node])), [bloodline]);

  function isDim(key: string): boolean {
    return Boolean(effectiveDim && !effectiveDim.has(key));
  }

  return (
    <div className="relative h-full w-full">
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
        {bloodline.edges.map((e) => {
          const x1 = e.x1 * 100;
          const y1 = e.y1 * 100;
          const x2 = e.x2 * 100;
          const y2 = e.y2 * 100;
          const ym = (y1 + y2) / 2;
          const childNode = nodeByKey.get(e.fromKey);
          const unreadOpacity = childNode?.kind === "book" && childNode.unread ? 0.55 : 1;
          // A vertical S-curve (leaves the parent heading straight down,
          // arrives at the child heading straight down) rather than a raw
          // diagonal -- reads as a flowing timeline branching, not a wiring
          // diagram, and doesn't visually shout "these are far apart in x"
          // when the real story is the vertical (time) distance.
          return (
            <path
              key={`${e.fromKey}->${e.toKey}`}
              d={`M ${x1},${y1} C ${x1},${ym} ${x2},${ym} ${x2},${y2}`}
              fill="none"
              className="stroke-gold-strong transition-opacity"
              style={{ opacity: (isDim(e.fromKey) ? 0.3 : 1) * unreadOpacity }}
              strokeWidth={variant === "preview" ? 1 : 1.5}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {bloodline.nodes.map(({ node, x, y }) => {
        const dim = isDim(node.key);
        // TBR entries stay "ever so slightly greyed out" always, on top of
        // (not instead of) the dim/highlight state, so an unread book is
        // still recognizably unread even while its bloodline is highlighted.
        const unreadOpacity = node.kind === "book" && node.unread ? 0.55 : 1;
        const selected = selectedKey === node.key;
        const label = nodeLabel(node);
        const boxSize = {
          width: node.kind === "book" ? (nodeSize * 2) / 3 : rootSize,
          height: node.kind === "book" ? nodeSize : rootSize,
        };
        const boxClasses = `overflow-hidden rounded shadow-md transition ${node.kind !== "book" ? "rounded-full" : ""} ${
          selected ? "ring-2 ring-gold-ink ring-offset-1 ring-offset-surface-1" : ""
        }`;
        const cover =
          node.kind === "book" ? (
            <CoverThumb title={node.title} coverUrl={node.coverUrl} className="h-full w-full" />
          ) : (
            <RootAvatar name={node.name} className="h-full w-full" />
          );

        let box;
        if (mode === "explore" && node.kind === "book" && !node.unread) {
          box = (
            <Link href={`/books/${node.bookId}`} style={boxSize} className={`block ${boxClasses} hover:scale-105`}>
              {cover}
            </Link>
          );
        } else if (traceMode) {
          box = (
            <button
              type="button"
              onClick={() => onSelectNode?.(node)}
              style={boxSize}
              className={`${boxClasses} cursor-pointer hover:scale-105`}
            >
              {cover}
            </button>
          );
        } else {
          box = (
            <div style={boxSize} className={boxClasses}>
              {cover}
            </div>
          );
        }

        return (
          <div
            key={node.key}
            className="absolute flex flex-col items-center transition-opacity"
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              transform: "translate(-50%, -50%)",
              opacity: (dim ? 0.3 : 1) * unreadOpacity,
            }}
            onMouseEnter={hoverEnabled ? () => setHoverKey(node.key) : undefined}
            onMouseLeave={hoverEnabled ? () => setHoverKey((k) => (k === node.key ? null : k)) : undefined}
          >
            {box}
            {variant === "focused" && (
              <span className="mt-1 max-w-[90px] truncate text-center text-[9px] text-ink-warm-faint">{label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
