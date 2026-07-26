import type { TierId } from "../types";

// One row per placed book (an inner join of book_tiers + books) -- every
// field the six sections need, loaded once and sliced/grouped client-side,
// the same shape /stats uses for its single `books: BookSummary[]` prop.
export type TierStatBook = {
  book_id: number;
  title: string;
  cover_url: string | null;
  tier: TierId;
  placed_at: string; // ISO timestamp -- first entry onto the board, see tierMovesMath.ts note
  author: string | null;
  author_id: number | null;
  series: string | null;
  genre: string | null;
  format_type: string | null;
  year_released: number | null;
  year_read: number;
  page_count: number;
  word_count: number | null;
  avg_pages_per_day: number | null;
  date_started: string | null;
  date_finished: string | null;
  score: number | null;
};

export type TierMoveFull = {
  id: number;
  book_id: number;
  title: string;
  cover_url: string | null;
  score: number | null;
  from_tier: TierId | null;
  to_tier: TierId;
  moved_at: string; // full ISO timestamp (not just date) -- eviction pairing needs the exact instant
};

export type SeriesParent = { series: string; parent_series: string | null };
