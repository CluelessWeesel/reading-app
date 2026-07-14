import type { CrownEntry, CrownsPerYear, DynastyEntry, WeeselCategory, WeeselRow, YearCategoryBlock } from "./types";

// Categories where the nominee is the book itself.
const BOOK_CATEGORIES = new Set([
  "Novel of the Year",
  "Non-Fiction of the Year",
  "Best Indie",
  "Most Thought-Provoking",
  "Best to Recommend",
  "Best Narration",
  "Best Reread",
]);
// The nominee is the author's own name directly.
const AUTHOR_NAME_CATEGORIES = new Set(["Author of the Year", "Best New Author", "Most Anticipated Author"]);

export function isBookCategory(categoryName: string): boolean {
  return BOOK_CATEGORIES.has(categoryName);
}

// The nominee/winner *is* the author -- there's no separate book or series
// identity to show as the primary line, unlike Best Series (a series name)
// or the book categories (a title).
export function isAuthorIdentityCategory(categoryName: string): boolean {
  return AUTHOR_NAME_CATEGORIES.has(categoryName);
}

export function displayTitle(row: WeeselRow): string {
  return row.book_title ?? row.nominee;
}

// The person credited for the Hall of Fame's author leaderboard -- resolved
// via the actual book author wherever a book_id exists (authoritative, and
// the only way to avoid crediting a narrator for Best Narration), else the
// nominee text itself for the pure-author categories, else
// author_or_narrator (Best Series credits the series' author there).
export function creditedAuthorName(row: WeeselRow, categoryName: string): string | null {
  if (row.book_author != null) return row.book_author;
  if (AUTHOR_NAME_CATEGORIES.has(categoryName)) return row.nominee;
  return row.author_or_narrator;
}

export function creditedAuthorId(row: WeeselRow, categoryName: string): number | null {
  if (row.book_author_id != null) return row.book_author_id;
  if (AUTHOR_NAME_CATEGORIES.has(categoryName) && row.nominee_author_id != null) return row.nominee_author_id;
  return row.author_or_narrator_author_id ?? null;
}

export function categoryNameOf(row: WeeselRow, categoriesById: Map<number, WeeselCategory>): string {
  return (row.category_id != null ? categoriesById.get(row.category_id)?.name : undefined) ?? "";
}

export function computeBookCrowns(rows: WeeselRow[]): CrownEntry[] {
  const byBook = new Map<number, { label: string; count: number }>();
  for (const r of rows) {
    if (r.result !== "winner" || r.book_id == null) continue;
    const existing = byBook.get(r.book_id);
    if (existing) existing.count++;
    else byBook.set(r.book_id, { label: displayTitle(r), count: 1 });
  }
  return Array.from(byBook.entries())
    .map(([bookId, v]) => ({ label: v.label, count: v.count, bookId }))
    .sort((a, b) => b.count - a.count);
}

export function computeAuthorCrowns(rows: WeeselRow[], categoriesById: Map<number, WeeselCategory>): CrownEntry[] {
  const byAuthor = new Map<string, { count: number; authorId?: number }>();
  for (const r of rows) {
    if (r.result !== "winner") continue;
    const categoryName = categoryNameOf(r, categoriesById);
    const name = creditedAuthorName(r, categoryName);
    if (!name) continue;
    const authorId = creditedAuthorId(r, categoryName) ?? undefined;
    const existing = byAuthor.get(name);
    if (existing) existing.count++;
    else byAuthor.set(name, { count: 1, authorId });
  }
  return Array.from(byAuthor.entries())
    .map(([name, v]) => ({ label: name, count: v.count, authorId: v.authorId }))
    .sort((a, b) => b.count - a.count);
}

// Same credited-entity resolution as the crown leaderboards, but counting
// every nomination and keeping only entities that never actually won --
// computed separately for books and authors, same split as the crowns.
export function computeMostNominatedWithoutWin(
  rows: WeeselRow[],
  categoriesById: Map<number, WeeselCategory>
): { books: CrownEntry[]; authors: CrownEntry[] } {
  const bookNoms = new Map<number, { label: string; count: number; wins: number }>();
  const authorNoms = new Map<string, { count: number; wins: number; authorId?: number }>();

  for (const r of rows) {
    const categoryName = categoryNameOf(r, categoriesById);
    const isWin = r.result === "winner";

    if (r.book_id != null) {
      const existing = bookNoms.get(r.book_id);
      if (existing) {
        existing.count++;
        if (isWin) existing.wins++;
      } else {
        bookNoms.set(r.book_id, { label: displayTitle(r), count: 1, wins: isWin ? 1 : 0 });
      }
    }

    const authorName = creditedAuthorName(r, categoryName);
    if (authorName) {
      const authorId = creditedAuthorId(r, categoryName) ?? undefined;
      const existing = authorNoms.get(authorName);
      if (existing) {
        existing.count++;
        if (isWin) existing.wins++;
      } else {
        authorNoms.set(authorName, { count: 1, wins: isWin ? 1 : 0, authorId });
      }
    }
  }

  const books = Array.from(bookNoms.entries())
    .filter(([, v]) => v.wins === 0)
    .map(([bookId, v]) => ({ label: v.label, count: v.count, bookId }))
    .sort((a, b) => b.count - a.count);

  const authors = Array.from(authorNoms.entries())
    .filter(([, v]) => v.wins === 0)
    .map(([name, v]) => ({ label: name, count: v.count, authorId: v.authorId }))
    .sort((a, b) => b.count - a.count);

  return { books, authors };
}

export function computeDynasties(rows: WeeselRow[], categories: WeeselCategory[]): DynastyEntry[] {
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const byCategory = new Map<number, WeeselRow[]>();
  for (const r of rows) {
    if (r.result !== "winner" || r.category_id == null) continue;
    if (!byCategory.has(r.category_id)) byCategory.set(r.category_id, []);
    byCategory.get(r.category_id)!.push(r);
  }

  return categories
    .filter((c) => byCategory.has(c.id))
    .map((c) => {
      const winners = (byCategory.get(c.id) ?? [])
        .slice()
        .sort((a, b) => a.year - b.year)
        .map((r) => {
          const categoryName = categoryNameOf(r, categoriesById);
          return {
            year: r.year,
            label: isBookCategory(categoryName) ? displayTitle(r) : r.nominee,
            bookId: r.book_id ?? undefined,
            authorId: creditedAuthorId(r, categoryName) ?? undefined,
          };
        });
      return { category: c.name, winners };
    });
}

// A category "existed" by a given year if it has data in that year or any
// earlier one -- lets a brand-new category (Best Indie, first run 2024)
// stay invisible on the 2023 page instead of showing a confusing "did not
// run", while a long-running category that happened to skip a year still
// shows collapsed.
export function computeYearCategoryBlocks(
  year: number,
  rows: WeeselRow[],
  categories: WeeselCategory[]
): YearCategoryBlock[] {
  const firstYearSeen = new Map<number, number>();
  for (const r of rows) {
    if (r.category_id == null) continue;
    const existing = firstYearSeen.get(r.category_id);
    if (existing == null || r.year < existing) firstYearSeen.set(r.category_id, r.year);
  }

  return categories.map((c) => {
    const yearRows = rows.filter((r) => r.category_id === c.id && r.year === year);
    const winner = yearRows.find((r) => r.result === "winner") ?? null;
    const nominees = yearRows.filter((r) => r.result !== "winner");
    const firstSeen = firstYearSeen.get(c.id);
    const existedByThisYear = firstSeen != null && firstSeen <= year;

    const status: YearCategoryBlock["status"] =
      yearRows.length > 0 ? "ran" : existedByThisYear ? "did-not-run" : "not-yet-existing";

    return { category: c, status, winner, nominees };
  });
}

export function computeCrownsPerYear(rows: WeeselRow[]): CrownsPerYear[] {
  const byYear = new Map<number, number>();
  for (const r of rows) {
    if (r.result !== "winner") continue;
    byYear.set(r.year, (byYear.get(r.year) ?? 0) + 1);
  }
  return Array.from(byYear.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);
}
