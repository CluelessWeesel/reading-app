import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import { ordinal } from "../../books/[id]/format";
import type { Mover } from "../risersMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M4.5 17 C4.5 13.5 7 11.5 10 11.5 C13 11.5 15.5 13.5 15.5 17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

// Full year-over-year comparison (this year vs. end of last year) on the
// author avgPercentile ("Consistency") board -- rank *position* on that
// board (e.g. "40th to 30th"), not a raw percentile number. Unlike the
// pages-based Risers widget, this doesn't hide itself when nobody climbed:
// with 78+ authors on the board and only a handful of movers in a given
// year, having zero real winners is a real possibility (confirmed live),
// so computeWinnersAndLosers backfills empty winner slots with the
// biggest fallers instead.
export function WinnersAndLosersWidget({ movers }: { movers: Mover[] | null }) {
  if (!movers) return null;

  return (
    <WidgetCard title="Winners and losers" accent="green" icon={ICON} compact>
      <ul className="space-y-1.5">
        {movers.map((m) => (
          <li key={m.author} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate">
              {m.authorId != null ? (
                <Link href={`/authors/${m.authorId}`} className="text-ink-warm hover:underline">
                  {m.author}
                </Link>
              ) : (
                <span className="text-ink-warm">{m.author}</span>
              )}
            </span>
            <span
              className={`shrink-0 text-[11px] font-semibold ${
                m.kind === "winner" ? "text-accent-green" : "text-accent-coral"
              }`}
            >
              {ordinal(m.rankBefore)} → {ordinal(m.rankNow)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-ink-warm-faint">Consistency-board position, vs. end of last year</p>
    </WidgetCard>
  );
}

WinnersAndLosersWidget.size = "compact" as const;
