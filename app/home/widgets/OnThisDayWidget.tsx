import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import type { OnThisDayEntry } from "../memoryMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10 6.5 L10 10 L12.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="10" r="1" fill="currentColor" />
  </svg>
);

export function OnThisDayWidget({ entries }: { entries: OnThisDayEntry[] | null }) {
  if (!entries || entries.length === 0) return null;

  return (
    <WidgetCard title="On this day" accent="purple" icon={ICON} compact>
      <ul className="space-y-1">
        {entries.slice(0, 3).map((e) => (
          <li key={e.bookId} className="truncate text-xs text-ink-warm-faint">
            <Link href={`/books/${e.bookId}`} className="text-ink-warm hover:underline">
              {e.title}
            </Link>{" "}
            · {e.year}
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

OnThisDayWidget.size = "micro" as const;
