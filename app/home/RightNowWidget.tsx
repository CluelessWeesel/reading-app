import Link from "next/link";
import { CoverThumb } from "../shared/CoverThumb";
import { formatDateShort } from "../shared/formatDateShort";
import { formatPositionLabel } from "../shared/positionMath";
import { WidgetShell } from "./WidgetShell";
import type { RightNowBook } from "./types";

export function RightNowWidget({
  books,
  todayPages,
  currentStreak,
}: {
  books: RightNowBook[];
  todayPages: number;
  currentStreak: number | null;
}) {
  return (
    <WidgetShell title="Right now">
      {books.length === 0 ? (
        <p className="text-sm text-ink-faint">Nothing in progress right now.</p>
      ) : (
        <ul className="space-y-3">
          {books.map((book) => (
            <li key={book.book_id} className="flex items-center gap-3">
              <Link href={`/books/${book.book_id}`} className="shrink-0">
                <CoverThumb title={book.title} coverUrl={book.cover_url} className="aspect-[2/3] w-12" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/books/${book.book_id}`}
                  className="block truncate text-sm font-semibold text-ink hover:underline"
                >
                  {book.title}
                </Link>
                <p className="truncate text-xs text-ink-faint">
                  {formatPositionLabel(book.position, book.format_type, book.page_count)}
                  {book.format_type !== "audio" && ` · ${book.percent.toFixed(0)}%`}
                  {book.estFinish && ` · est. ${formatDateShort(book.estFinish)}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
        {todayPages > 0 ? (
          <p className="text-sm text-ink">
            <span className="font-semibold">{todayPages}</span> pages logged today
          </p>
        ) : (
          <Link
            href="/log"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent shadow-sm transition hover:brightness-95"
          >
            Log tonight
          </Link>
        )}
        {currentStreak != null && currentStreak > 0 && (
          <p className="text-xs text-ink-faint">{currentStreak} day streak</p>
        )}
      </div>
    </WidgetShell>
  );
}
