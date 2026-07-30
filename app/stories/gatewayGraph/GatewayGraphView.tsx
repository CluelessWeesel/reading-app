"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fraunces } from "../../shared/fonts";
import { CoverThumb } from "../../shared/CoverThumb";
import { computeGatewayGraph, type GatewayBookRow, type TbrGatewayRow } from "./math";
import { BloodlineGrid } from "./BloodlineGrid";
import { FocusedBloodline } from "./FocusedBloodline";
import { StatsPanel } from "./StatsPanel";
import { WholeTreeByDate } from "./WholeTreeByDate";

type View = { kind: "grid" } | { kind: "focused"; rootKey: string } | { kind: "wholeDate" };

export function GatewayGraphView({ rows, tbrRows }: { rows: GatewayBookRow[]; tbrRows: TbrGatewayRow[] }) {
  const summary = useMemo(() => computeGatewayGraph(rows, tbrRows), [rows, tbrRows]);
  const [view, setView] = useState<View>({ kind: "grid" });

  const isSparse = summary.bloodlines.length === 0 && summary.orphans.length === 0;
  const focusedBloodline = view.kind === "focused" ? summary.bloodlines.find((b) => b.rootKey === view.rootKey) ?? null : null;

  return (
    <div>
      <h1 className={`${fraunces.className} text-3xl font-semibold text-ink-warm sm:text-4xl`}>Gateway Graph</h1>
      <p className="mb-6 mt-1 text-sm text-ink-warm-faint">Where your reading came from, one branch at a time.</p>

      {isSparse ? (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
          <SparseState untracedCount={summary.untracedCount} totalBooks={summary.totalBooks} untracedBooks={summary.untracedBooks} />
          <StatsPanel summary={summary} />
        </div>
      ) : view.kind === "wholeDate" ? (
        <WholeTreeByDate bloodlines={summary.bloodlines} onClose={() => setView({ kind: "grid" })} />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 rounded-2xl border border-gold bg-surface-1 p-5 shadow-sm">
            {view.kind === "focused" && focusedBloodline ? (
              <FocusedBloodline bloodline={focusedBloodline} onBack={() => setView({ kind: "grid" })} />
            ) : (
              <BloodlineGrid
                summary={summary}
                onFocus={(rootKey) => setView({ kind: "focused", rootKey })}
                onOpenWholeDate={() => setView({ kind: "wholeDate" })}
              />
            )}
          </div>
          <StatsPanel summary={summary} />
        </div>
      )}
    </div>
  );
}

function SparseState({
  untracedCount,
  totalBooks,
  untracedBooks,
}: {
  untracedCount: number;
  totalBooks: number;
  untracedBooks: GatewayBookRow[];
}) {
  // Oldest first, matching triage order -- these are the books you'd trace first.
  const holding = [...untracedBooks]
    .sort((a, b) => {
      if (!a.date_finished && !b.date_finished) return 0;
      if (!a.date_finished) return 1;
      if (!b.date_finished) return -1;
      return a.date_finished.localeCompare(b.date_finished);
    })
    .slice(0, 5);
  const moreCount = untracedCount - holding.length;

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-gold bg-surface-1 px-6 py-14 text-center shadow-sm">
      <div className="text-4xl">🌱</div>
      <h2 className={`${fraunces.className} text-xl font-semibold text-ink-warm`}>Your tree is just getting planted</h2>
      <p className="max-w-md text-sm leading-relaxed text-ink-warm-muted">
        Nothing&apos;s traced yet -- that&apos;s expected for a brand-new tree, not a problem to fix. Every book you trace
        (or mark &quot;found it myself&quot;) plants a node here. Start anywhere; there&apos;s no wrong place to begin.
      </p>
      <Link
        href="/library?trace=1"
        className="mt-1 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-on-accent shadow-sm transition hover:brightness-95"
      >
        Trace gateways →
      </Link>
      {holding.length > 0 && (
        <div className="mt-2 flex max-w-xl flex-wrap justify-center gap-2">
          {holding.map((b) => (
            <div
              key={b.book_id}
              className="flex items-center gap-1.5 rounded-full border border-gold bg-surface-2 py-1 pl-1 pr-2.5 text-xs text-ink-warm-muted"
            >
              <CoverThumb title={b.title} coverUrl={b.cover_url} className="aspect-[2/3] w-4" />
              {b.title}
            </div>
          ))}
          {moreCount > 0 && <div className="self-center px-2 py-1 text-xs text-ink-warm-faint">+{moreCount} more, untouched</div>}
        </div>
      )}
      {totalBooks === 0 && <p className="text-xs text-ink-warm-faint">Your library&apos;s empty too -- one thing at a time.</p>}
    </div>
  );
}
