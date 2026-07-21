import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import type { Anniversary } from "../memoryMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <path
      d="M10 3 L11.8 7.6 L16.8 8 L13 11.2 L14.1 16 L10 13.3 L5.9 16 L7 11.2 L3.2 8 L8.2 7.6 Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  </svg>
);

// Distinct from On This Day (which is about *finishing* a book on this
// calendar date in a past year) -- this is about *starting* one, so the
// two don't just duplicate the same underlying event from two labels.
export function AnniversariesWidget({ anniversaries }: { anniversaries: Anniversary[] | null }) {
  if (!anniversaries || anniversaries.length === 0) return null;

  return (
    <WidgetCard title="Anniversaries" accent="purple" icon={ICON} compact>
      <ul className="space-y-1">
        {anniversaries.slice(0, 3).map((a) => (
          <li key={a.bookId} className="truncate text-xs text-ink-warm-faint">
            Started{" "}
            <Link href={`/books/${a.bookId}`} className="text-ink-warm hover:underline">
              {a.title}
            </Link>{" "}
            {a.yearsAgo} year{a.yearsAgo === 1 ? "" : "s"} ago today
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

AnniversariesWidget.size = "micro" as const;
