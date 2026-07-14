import Link from "next/link";
import type { ReactNode } from "react";
import { fraunces } from "../shared/fonts";
import { formatPagesK } from "../stats/statsMath";
import { WidgetShell } from "./WidgetShell";
import type { AuthorOfYear, TopBookOfYear } from "./types";

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-hairline bg-card/70 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`${fraunces.className} truncate text-lg font-semibold text-ink`}>{value}</p>
    </div>
  );
}

export function YearSoFarWidget({
  currentYear,
  booksFinished,
  totalPages,
  totalWordsEstimate,
  authorOfYear,
  topBook,
}: {
  currentYear: number;
  booksFinished: number;
  totalPages: number;
  totalWordsEstimate: number;
  authorOfYear: AuthorOfYear;
  topBook: TopBookOfYear | null;
}) {
  return (
    <WidgetShell title={`${currentYear} so far`} href="/stats" hrefLabel="Full stats">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Books" value={booksFinished} />
        <StatCard label="Pages" value={formatPagesK(totalPages)} />
        <StatCard label="Words" value={formatPagesK(totalWordsEstimate)} />
        <StatCard
          label="Author of the year"
          value={
            authorOfYear ? (
              <Link href={`/authors/${authorOfYear.id}`} className="hover:underline">
                {authorOfYear.name}
              </Link>
            ) : (
              "--"
            )
          }
        />
      </div>

      {topBook && (
        <p className="mt-3 text-xs text-ink-faint">
          Highest ranked so far:{" "}
          <Link href={`/books/${topBook.book_id}`} className="text-ink hover:underline">
            {topBook.title}
          </Link>{" "}
          <span
            className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: topBook.background, color: topBook.color }}
          >
            #{topBook.rank} of {topBook.total}
          </span>
        </p>
      )}
    </WidgetShell>
  );
}
