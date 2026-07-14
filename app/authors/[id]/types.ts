export type AuthorBook = {
  book_id: number;
  title: string;
  cover_url: string | null;
  score: number | null;
  year_read: number;
  year_released: number | null;
  word_count: number | null;
  page_count: number;
  avg_pages_per_day: number | null;
  review: string | null;
  legacy_notes: string | null;
  date_started: string | null;
  date_finished: string | null;
};

export type RankingInfo = { rank: number; year: number; total: number };

export type PromptAnswer = { book_id: number; book_title: string; question: string; answer: string };

export type QueuedEntry = { id: number; title: string; cover_url: string | null; word_count: number | null };

export type WeeselRow = { year: number; category: string; result: "winner" | "nominee" };

export type AuthorDetail = {
  id: number;
  name: string;
  photo_url: string | null;
  books: AuthorBook[];
  rankings: Record<number, RankingInfo>;
  promptAnswers: PromptAnswer[];
  queued: QueuedEntry[];
  weesels: WeeselRow[];
  rankByPages: number | null;
  totalAuthors: number;
  percentOfEverything: number | null;
};
