import { notFound, redirect } from "next/navigation";
import { getCategories, getSealedYears } from "../../data";
import {
  getAllAuthors,
  getAuthorsFirstReadThisYear,
  getCategoryStatuses,
  getWatchlistByCategory,
  getYearFinishedBooks,
} from "../data";
import { computeCategoryPool, isManualPickCategory } from "../eligibility";
import { CeremonyView } from "./CeremonyView";
import type { CeremonyCategoryData } from "./CeremonyView";

export const dynamic = "force-dynamic";

export default async function CeremonyPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isInteger(year)) notFound();

  const sealedYears = await getSealedYears();
  if (sealedYears.has(year)) redirect(`/weesels/${year}`);

  const [categories, yearBooks, authorsFirstReadThisYear, allAuthors, watchlistByCategory] = await Promise.all([
    getCategories(),
    getYearFinishedBooks(year),
    getAuthorsFirstReadThisYear(year),
    getAllAuthors(),
    getWatchlistByCategory(year),
  ]);
  // The ceremony runs in ascending prestige -- Best Narration (prestige_order
  // 11) first, Author of the Year (prestige_order 1) last -- the opposite of
  // getCategories()'s natural ordering, which every other Weesels surface
  // (archive pages, Hall of Fame) reads most-prestigious-first.
  const activeCategories = categories.filter((c) => c.active).reverse();
  const statuses = await getCategoryStatuses(year, activeCategories);

  const categoryData: CeremonyCategoryData[] = activeCategories.map((category) => {
    const pool = computeCategoryPool(category, yearBooks, authorsFirstReadThisYear);
    const watched = watchlistByCategory.get(category.id) ?? [];
    const watchedBookIds = new Set(watched.map((w) => w.bookId));
    const starredPool = pool.map((c) => (c.bookId != null && watchedBookIds.has(c.bookId) ? { ...c, preStarred: true } : c));
    const poolBookIds = new Set(pool.map((c) => c.bookId).filter((id): id is number => id != null));
    const watchedSuggestions = watched.filter((w) => !poolBookIds.has(w.bookId));

    return {
      category,
      status: statuses.get(category.id) ?? { state: "unreviewed" },
      computedPool: starredPool,
      watchedSuggestions,
      isManualPick: isManualPickCategory(category.name),
    };
  });

  return (
    <CeremonyView
      year={year}
      categoryData={categoryData}
      yearBooks={yearBooks}
      allAuthors={allAuthors}
    />
  );
}
