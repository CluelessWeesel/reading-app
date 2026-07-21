import Link from "next/link";
import { fraunces } from "../shared/fonts";
import { CoverThumb } from "../shared/CoverThumb";
import { daysBetweenInclusive, todayLocalIso } from "../shared/isoDate";
import { getCategories } from "./data";
import {
  getAuthorsFirstReadThisYear,
  getCategoryStatuses,
  getWatchedShortlist,
  getYearFinishedBooks,
} from "./ceremony/data";
import { computeCategoryPool } from "./ceremony/eligibility";
import type { WeeselCategory } from "./types";
import type { AuthorOption, CategoryStatus, YearFinishedBook } from "./ceremony/types";

function describeCategory(
  category: WeeselCategory,
  status: CategoryStatus,
  yearBooks: YearFinishedBook[],
  authorsFirstReadThisYear: AuthorOption[]
): string {
  if (status.state === "unreviewed") {
    const count = computeCategoryPool(category, yearBooks, authorsFirstReadThisYear).length;
    if (count >= category.min_candidates) return `${count} candidates — running`;
    const needed = category.min_candidates - count;
    return `${count} candidate${count === 1 ? "" : "s"} — ${needed} more to run`;
  }
  if (status.state === "confirmed-not-running") return "confirmed — not running this year";
  if (status.state === "confirmed-running") {
    return `${status.nominees.length} candidates — confirmed, awaiting reveal`;
  }
  return `winner: ${status.winner.label}`;
}

export async function SeasonTracker({ year }: { year: number }) {
  const [categories, yearBooks, authorsFirstReadThisYear, shortlist] = await Promise.all([
    getCategories(),
    getYearFinishedBooks(year),
    getAuthorsFirstReadThisYear(year),
    getWatchedShortlist(year),
  ]);
  const activeCategories = categories.filter((c) => c.active);
  const statuses = await getCategoryStatuses(year, activeCategories);

  const today = todayLocalIso();
  const daysUntil = daysBetweenInclusive(today, `${year}-12-25`) - 1;

  return (
    <section className="mt-8 rounded-xl border border-gold bg-surface-1 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${fraunces.className} text-lg font-semibold text-ink-warm`}>{year} season tracker</h2>
        <p className="text-xs text-ink-warm-faint">
          {daysUntil > 0
            ? `${daysUntil} day${daysUntil === 1 ? "" : "s"} until the ceremony window (Dec 25)`
            : "Ceremony window open"}
        </p>
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {activeCategories.map((category) => {
          const status = statuses.get(category.id) ?? { state: "unreviewed" as const };
          return (
            <li
              key={category.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gold bg-surface-1 px-3 py-1.5 text-xs"
            >
              <span className="text-ink-warm">{category.name}</span>
              <span className="text-ink-warm-faint">
                {describeCategory(category, status, yearBooks, authorsFirstReadThisYear)}
              </span>
            </li>
          );
        })}
      </ul>

      {shortlist.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-ink-warm-faint">Your watched shortlist</p>
          <div className="flex flex-wrap gap-2">
            {shortlist.map((s) => (
              <div
                key={s.bookId}
                className="flex items-center gap-2 rounded-full border border-gold bg-surface-1 py-1 pl-1 pr-2.5 text-xs"
              >
                <CoverThumb title={s.title} coverUrl={s.coverUrl} className="aspect-[2/3] w-5" />
                <span className="text-ink-warm">{s.title}</span>
                <span className="text-ink-warm-faint">· {s.categoryNames.join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link
        href={`/weesels/ceremony/${year}`}
        className="mt-4 inline-block text-xs text-ink-warm-faint underline decoration-dotted underline-offset-4 hover:text-ink-warm"
      >
        Run the ceremony →
      </Link>
    </section>
  );
}
