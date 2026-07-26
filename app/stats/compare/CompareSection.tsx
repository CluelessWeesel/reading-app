import type { ReactNode } from "react";
import { fraunces } from "@/app/shared/fonts";

// Every section's shared chrome: title, a card, the section's content, and
// the generated one-line verdict beneath it -- or, when a combatant has
// nothing for this section (a projection has no real books, a year with no
// rank history, etc), a graceful "not tracked" message instead of a broken
// widget. Centralizing this here means each section only has to decide
// WHETHER it has data, not how to render either outcome.
// Small paired stat tile -- label plus a left/right value, reused across
// Volume/Pace/Format rather than each section rolling its own.
export function PairTile({ label, leftValue, rightValue }: { label: string; leftValue: string; rightValue: string }) {
  return (
    <div className="rounded-lg border border-gold bg-surface-1 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className={`${fraunces.className} truncate text-lg font-semibold text-ink-warm`}>{leftValue}</span>
        <span className="shrink-0 text-xs text-ink-warm-faint">vs</span>
        <span className={`${fraunces.className} truncate text-lg font-semibold text-ink-warm`}>{rightValue}</span>
      </div>
    </div>
  );
}

export function CompareSection({
  title,
  verdict,
  notTracked,
  children,
}: {
  title: string;
  verdict?: string | null;
  notTracked?: string | null;
  children?: ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className={`${fraunces.className} mb-3 text-xl font-semibold text-ink-warm`}>{title}</h2>
      <div className="rounded-xl border border-gold bg-surface-1 p-4">
        {notTracked ? (
          <p className="py-6 text-center text-sm text-ink-warm-faint">{notTracked}</p>
        ) : (
          <>
            {children}
            {verdict && <p className="mt-3 border-t border-gold pt-3 text-sm text-ink-warm">{verdict}</p>}
          </>
        )}
      </div>
    </section>
  );
}
