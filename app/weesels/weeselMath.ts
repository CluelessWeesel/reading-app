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

// The person credited for the Hall of Fame's author leaderboard. Best
// Narration is an award for the narrator's performance, not the author's
// writing, so it's credited via author_or_narrator (the narrator) --
// crediting the book's actual author there would silently hand the
// narrator's win to someone else. Every other book category credits the
// actual book author (authoritative); the pure-author categories credit the
// nominee text itself; Best Series credits the series' author via
// author_or_narrator. There's no narrators table yet, so a narrator's id
// stays unresolved (null) until one exists -- the name alone is enough to
// count and group them correctly today.
export function creditedAuthorName(row: WeeselRow, categoryName: string): string | null {
  if (categoryName === "Best Narration") return row.author_or_narrator;
  if (row.book_author != null) return row.book_author;
  if (AUTHOR_NAME_CATEGORIES.has(categoryName)) return row.nominee;
  return row.author_or_narrator;
}

export function creditedAuthorId(row: WeeselRow, categoryName: string): number | null {
  if (categoryName === "Best Narration") return row.author_or_narrator_author_id ?? null;
  if (row.book_author_id != null) return row.book_author_id;
  if (AUTHOR_NAME_CATEGORIES.has(categoryName) && row.nominee_author_id != null) return row.nominee_author_id;
  return row.author_or_narrator_author_id ?? null;
}

// Best Narration is the one category credited to a narrator, not an
// author -- this resolves their real id via the narrators table (see
// getWeeselRows), so their wins can link to their own /narrators page
// instead of an author-table name collision (or nothing at all). Null for
// every other category.
export function creditedNarratorId(row: WeeselRow, categoryName: string): number | null {
  if (categoryName !== "Best Narration") return null;
  return row.author_or_narrator_narrator_id ?? null;
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
  const byAuthor = new Map<string, { count: number; authorId?: number; narratorId?: number }>();
  for (const r of rows) {
    if (r.result !== "winner") continue;
    const categoryName = categoryNameOf(r, categoriesById);
    const name = creditedAuthorName(r, categoryName);
    if (!name) continue;
    const authorId = creditedAuthorId(r, categoryName) ?? undefined;
    const narratorId = creditedNarratorId(r, categoryName) ?? undefined;
    const existing = byAuthor.get(name);
    if (existing) existing.count++;
    else byAuthor.set(name, { count: 1, authorId, narratorId });
  }
  return Array.from(byAuthor.entries())
    .map(([name, v]) => ({ label: name, count: v.count, authorId: v.authorId, narratorId: v.narratorId }))
    .sort((a, b) => b.count - a.count);
}

// Every nomination regardless of outcome (wins included) -- the "how many
// times nominated" counterpart to computeAuthorCrowns' "how many times
// won," same credited-entity resolution throughout.
export function computeAuthorNominations(
  rows: WeeselRow[],
  categoriesById: Map<number, WeeselCategory>
): CrownEntry[] {
  const byAuthor = new Map<string, { count: number; authorId?: number; narratorId?: number }>();
  for (const r of rows) {
    const categoryName = categoryNameOf(r, categoriesById);
    const name = creditedAuthorName(r, categoryName);
    if (!name) continue;
    const authorId = creditedAuthorId(r, categoryName) ?? undefined;
    const narratorId = creditedNarratorId(r, categoryName) ?? undefined;
    const existing = byAuthor.get(name);
    if (existing) existing.count++;
    else byAuthor.set(name, { count: 1, authorId, narratorId });
  }
  return Array.from(byAuthor.entries())
    .map(([name, v]) => ({ label: name, count: v.count, authorId: v.authorId, narratorId: v.narratorId }))
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
  const authorNoms = new Map<string, { count: number; wins: number; authorId?: number; narratorId?: number }>();

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
      const narratorId = creditedNarratorId(r, categoryName) ?? undefined;
      const existing = authorNoms.get(authorName);
      if (existing) {
        existing.count++;
        if (isWin) existing.wins++;
      } else {
        authorNoms.set(authorName, { count: 1, wins: isWin ? 1 : 0, authorId, narratorId });
      }
    }
  }

  const books = Array.from(bookNoms.entries())
    .filter(([, v]) => v.wins === 0)
    .map(([bookId, v]) => ({ label: v.label, count: v.count, bookId }))
    .sort((a, b) => b.count - a.count);

  const authors = Array.from(authorNoms.entries())
    .filter(([, v]) => v.wins === 0)
    .map(([name, v]) => ({ label: name, count: v.count, authorId: v.authorId, narratorId: v.narratorId }))
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
            narratorId: creditedNarratorId(r, categoryName) ?? undefined,
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
