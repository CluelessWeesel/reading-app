export type RankedRow = {
  book_id: number | null;
  rank: number;
  title: string;
  author: string | null;
  author_id: number | null;
  cover_url: string | null;
  score: number | null;
  had_star: boolean;
};

export type UnrankedRow = {
  book_id: number;
  title: string;
  author: string | null;
  author_id: number | null;
  cover_url: string | null;
  score: number | null;
};

export type Movement = { old_rank: number | null; new_rank: number };

export type AdjustmentEvent = {
  kind: "rank" | "score";
  book_id: number;
  title: string;
  old_val: number | null;
  new_val: number | null;
  reason: string;
  changed_at: string;
};

export type AdjustmentWindowData = {
  year: number;
  isOpen: boolean;
  usedCount: number;
  limit: number;
  events: AdjustmentEvent[];
};

export type YearData = {
  year: number;
  ranked: RankedRow[];
  unranked: UnrankedRow[];
  movements: Record<number, Movement>;
};

// The three series_rankings lists -- fixed, manually curated, no year
// dimension. list_name is free text in the DB (no CHECK constraint), so this
// is the app-side source of truth for which values are valid.
export const SERIES_LIST_NAMES = [
  "Series Manually Ranked (1+ Books)",
  "Main Series Manually Ranked",
  "Sub Series Manually Ranked",
] as const;

export type SeriesListName = (typeof SERIES_LIST_NAMES)[number];

export const STATUS_FLAGS = ["Complete", "Not Complete", "Unpublished"] as const;
export type StatusFlag = (typeof STATUS_FLAGS)[number];

export type SeriesRankedRow = {
  rank: number;
  series: string;
  status_flag: StatusFlag;
  books_read: number;
  avg_score: number | null;
};
