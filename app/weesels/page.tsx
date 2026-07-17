import Link from "next/link";
import { fraunces } from "../shared/fonts";
import { getCategories, getSealedYears, getWeeselRows } from "./data";
import { HallOfFame } from "./HallOfFame";
import { SeasonTracker } from "./SeasonTracker";
import { WeeselYearCard } from "./WeeselYearCard";
import {
  computeAuthorCrowns,
  computeBookCrowns,
  computeCrownsPerYear,
  computeDynasties,
  computeMostNominatedWithoutWin,
} from "./weeselMath";

export const dynamic = "force-dynamic";

const YEARS = [2023, 2024, 2025, 2026];

export default async function WeeselsPage() {
  const [sealedYears, rows, categories] = await Promise.all([getSealedYears(), getWeeselRows(), getCategories()]);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));

  const winnerCountByYear = new Map<number, number>();
  for (const r of rows) {
    if (r.result !== "winner") continue;
    winnerCountByYear.set(r.year, (winnerCountByYear.get(r.year) ?? 0) + 1);
  }

  const bookCrowns = computeBookCrowns(rows);
  const authorCrowns = computeAuthorCrowns(rows, categoriesById);
  const { books: mostNominatedBooks, authors: mostNominatedAuthors } = computeMostNominatedWithoutWin(
    rows,
    categoriesById
  );
  const dynasties = computeDynasties(rows, categories);
  const crownsPerYear = computeCrownsPerYear(rows);
  const currentYear = new Date().getFullYear();
  const currentYearInSeason = YEARS.includes(currentYear) && !sealedYears.has(currentYear);

  return (
    <div className="min-h-full flex-1 bg-paper px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className={`${fraunces.className} text-3xl font-semibold text-ink sm:text-4xl`}>The Weesels</h1>
            <p className="mt-1 text-sm text-ink-faint">The annual reading awards, archived.</p>
          </div>
          <Link
            href="/weesels/leaderboard"
            className="rounded-full border border-hairline bg-card/70 px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-hover hover:text-ink"
          >
            Author wins leaderboard &rarr;
          </Link>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {YEARS.map((year) => (
            <WeeselYearCard
              key={year}
              year={year}
              sealed={sealedYears.has(year)}
              winnerCount={winnerCountByYear.get(year) ?? 0}
            />
          ))}
        </div>

        {currentYearInSeason && <SeasonTracker year={currentYear} />}

        <HallOfFame
          bookCrowns={bookCrowns}
          authorCrowns={authorCrowns}
          mostNominatedBooks={mostNominatedBooks}
          mostNominatedAuthors={mostNominatedAuthors}
          dynasties={dynasties}
          crownsPerYear={crownsPerYear}
        />
      </div>
    </div>
  );
}
