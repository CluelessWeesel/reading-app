// D turned out to carry far more variance than S/A/B/C, so it's split
// three ways (D/E/F) for the same resolving power the higher tiers already
// have -- everything downstream (capacities, drag-drop, the fill ceremony)
// just iterates this list, so nothing else needed to change shape-wise.
export const PLACEABLE_TIERS = ["S", "A", "B", "C", "D", "E", "F"] as const;
export type PlaceableTier = (typeof PLACEABLE_TIERS)[number];
export type TierId = PlaceableTier | "holding";
export const ALL_TIERS: TierId[] = ["S", "A", "B", "C", "D", "E", "F", "holding"];

export type TierBook = {
  book_id: number;
  title: string;
  author: string | null;
  author_id: number | null;
  cover_url: string | null;
  score: number | null;
  position: number;
};

export type TierBoardData = Record<TierId, TierBook[]>;

// A finished book that hasn't entered the board yet -- the opening fill's
// queue, ordered score-desc so the top tiers get real candidates early.
export type QueueBook = {
  book_id: number;
  title: string;
  author: string | null;
  cover_url: string | null;
  score: number | null;
};

// Percentages (0-100), keyed by tier -- the editable capacity settings.
export type Capacities = Record<PlaceableTier, number>;

export type TierMove = {
  id: number;
  book_id: number;
  title: string;
  cover_url: string | null;
  from_tier: TierId | null;
  to_tier: TierId;
  moved_at: string;
  note: string | null;
};
