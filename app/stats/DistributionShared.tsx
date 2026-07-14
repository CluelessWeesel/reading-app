"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { coverGradient } from "../shared/coverPalette";
import { fraunces } from "../shared/fonts";

export function pillClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-xs font-medium transition ${
    active ? "bg-accent text-on-accent" : "border border-hairline text-ink-muted hover:bg-hover"
  }`;
}

// Shared chrome for every /stats distribution card: title, collapse toggle,
// an optional row of view-toggle pills, and an optional "N excluded" note --
// shown as text, not silently dropped, whenever books are missing the field
// a card needs.
export function CollapsibleCard({
  title,
  toggle,
  excludedNote,
  children,
}: {
  title: string;
  toggle?: ReactNode;
  excludedNote?: string | null;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-xl border border-hairline bg-card/40 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className={`${fraunces.className} text-base font-semibold text-ink`}>{title}</h3>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand" : "Collapse"}
          aria-expanded={!collapsed}
          className="shrink-0 rounded-full px-2 py-0.5 text-xs text-ink-faint hover:bg-hover hover:text-ink"
        >
          {collapsed ? "▸" : "▾"}
        </button>
      </div>

      {!collapsed && (
        <>
          {toggle && <div className="mb-2 flex flex-wrap items-center gap-2">{toggle}</div>}
          {excludedNote && <p className="mb-2 text-xs text-ink-faint">{excludedNote}</p>}
          {children}
        </>
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-ink-faint">{message}</p>;
}

// Read-only cover thumbnail for drill-down lists -- unlike the editable
// <Cover> used on Library/TBR/Rankings, nothing here is meant to be edited,
// so this skips the edit-pencil overlay entirely rather than wiring up a
// no-op handler that would look functional but silently do nothing.
export function CoverThumb({ title, coverUrl }: { title: string; coverUrl: string | null }) {
  return (
    <div
      className={`relative aspect-[2/3] w-8 shrink-0 overflow-hidden rounded ${
        coverUrl
          ? "bg-paper"
          : `flex items-center justify-center bg-gradient-to-br shadow-sm ring-1 ring-black/10 dark:ring-white/10 ${coverGradient(title)}`
      }`}
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt={`Cover of ${title}`} loading="lazy" className="h-full w-full object-contain" />
      ) : (
        <span className={`${fraunces.className} text-xs font-semibold text-black/25 dark:text-white/25`}>
          {title.charAt(0)}
        </span>
      )}
    </div>
  );
}
