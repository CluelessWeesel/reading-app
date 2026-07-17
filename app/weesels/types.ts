export type WeeselCategory = {
  id: number;
  name: string;
  prestige_order: number;
  rereads_eligible: boolean;
  min_candidates: number;
  active: boolean;
};

export type WeeselRow = {
  id: number;
  year: number;
  category_id: number | null;
  book_id: number | null;
  nominee: string;
  author_or_narrator: string | null;
  result: "winner" | "nominee";
  citation: string | null;
  book_title: string | null;
  cover_url: string | null;
  book_author: string | null;
  book_author_id: number | null;
  book_genre: string | null;
  book_format_type: string | null;
  // Fallback author-id resolution for categories with no book_id -- see
  // weeselMath.ts's creditedAuthorId.
  nominee_author_id: number | null;
  author_or_narrator_author_id: number | null;
};

export type CrownEntry = { label: string; count: number; bookId?: number; authorId?: number };

export type DynastyEntry = {
  category: string;
  winners: { year: number; label: string; bookId?: number; authorId?: number }[];
};

export type CrownsPerYear = { year: number; count: number };

export type YearCategoryBlock = {
  category: WeeselCategory;
  // "ran": had nominations that year. "did-not-run": the category existed
  // by then but had no nominations (insufficient candidates). "not-yet-existing":
  // the category has no data in this year or any earlier one, so it's
  // hidden rather than shown as a confusing "did not run".
  status: "ran" | "did-not-run" | "not-yet-existing";
  winner: WeeselRow | null;
  nominees: WeeselRow[];
};

