import type { WeeselCategory } from "../types";
import type { AuthorOption, EligibleCandidate, YearFinishedBook } from "./types";

// The live genre list, split by name -- there's no genre-family column
// anywhere in the schema, so this mapping is the one place that decision
// lives. Anything not listed here (should only happen for a brand-new
// genre) falls into neither pool and simply won't be a candidate until
// this list is updated.
const NONFICTION_GENRES = new Set([
  "History",
  "Memoir & Biography",
  "Narrative Non-Fiction",
  "Philosophy",
  "Politics & Society",
  "Psychology & Self",
  "Religion",
  "Science & Society",
]);
const FICTION_GENRES = new Set(["Classic", "Dystopia", "Fantasy", "Horror & Thriller", "Literary Fiction", "Sci-Fi"]);

// Best Series ("completed a series this year") isn't detectable from the
// schema -- no book carries a "final entry in the series" flag, and
// "2+ finishes this year" can't tell an ongoing series from a finished one.
// Most Anticipated Author isn't about this year's finishes at all. Both are
// pure manual entry, never auto-populated.
const MANUAL_PICK_CATEGORIES = new Set(["Best Series", "Most Anticipated Author"]);

export function isManualPickCategory(categoryName: string): boolean {
  return MANUAL_PICK_CATEGORIES.has(categoryName);
}

function bookCandidate(b: YearFinishedBook, sublabel?: string | null): EligibleCandidate {
  return {
    key: `book-${b.book_id}`,
    label: b.title,
    sublabel: sublabel !== undefined ? sublabel : b.author,
    bookId: b.book_id,
    authorId: b.author_id,
    coverUrl: b.cover_url,
    photoUrl: null,
  };
}

function authorCandidate(authorId: number, name: string, photoUrl: string | null): EligibleCandidate {
  return {
    key: `author-${authorId}`,
    label: name,
    sublabel: null,
    bookId: null,
    authorId,
    coverUrl: null,
    photoUrl,
  };
}

// The computed starting pool for one category -- pre-flight lets you trim
// or add to this before confirming; nothing here is written anywhere yet.
export function computeCategoryPool(
  category: WeeselCategory,
  yearBooks: YearFinishedBook[],
  authorsFirstReadThisYear: AuthorOption[]
): EligibleCandidate[] {
  if (isManualPickCategory(category.name)) return [];

  switch (category.name) {
    case "Author of the Year": {
      const seen = new Map<number, EligibleCandidate>();
      for (const b of yearBooks) {
        if (b.author_id == null || seen.has(b.author_id)) continue;
        seen.set(b.author_id, authorCandidate(b.author_id, b.author, b.author_photo_url));
      }
      return Array.from(seen.values());
    }
    case "Best New Author":
      return authorsFirstReadThisYear.map((a) => authorCandidate(a.author_id, a.name, a.photo_url));
    case "Novel of the Year":
      return yearBooks.filter((b) => b.genre != null && FICTION_GENRES.has(b.genre)).map((b) => bookCandidate(b));
    case "Non-Fiction of the Year":
      return yearBooks.filter((b) => b.genre != null && NONFICTION_GENRES.has(b.genre)).map((b) => bookCandidate(b));
    case "Best Indie":
      return yearBooks.filter((b) => b.indie === true).map((b) => bookCandidate(b));
    case "Best Reread":
      return yearBooks.filter((b) => b.reread === true).map((b) => bookCandidate(b));
    case "Best Narration":
      // Nominee here is the narration, not just the book -- sublabel shows
      // the narrator (matches the historical data: author_or_narrator holds
      // the narrator's name for this category, not the author's).
      return yearBooks.filter((b) => b.format_type === "audio" && b.narrator).map((b) => bookCandidate(b, b.narrator));
    case "Most Thought-Provoking":
    case "Best to Recommend":
      // Subjective, pool broadly -- every finish this year, curation is
      // entirely the manual trim in pre-flight.
      return yearBooks.map((b) => bookCandidate(b));
    default:
      return [];
  }
}

export function verdictFor(finalCount: number, minCandidates: number): "runs" | "does-not-run" {
  return finalCount >= minCandidates ? "runs" : "does-not-run";
}
