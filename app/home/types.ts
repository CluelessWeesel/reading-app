export type RankBadge = { rank: number; total: number; background: string; color: string };

export type RightNowBook = {
  book_id: number;
  title: string;
  author: string | null;
  cover_url: string | null;
  format_type: string | null;
  page_count: number | null;
  position: number;
  date_started: string | null;
  percent: number;
  estFinish: string | null;
};

export type LatestFinish = {
  book_id: number;
  title: string;
  author: string | null;
  cover_url: string | null;
  score: number | null;
  date_started: string | null;
  date_finished: string;
  days: number | null;
  ranking: RankBadge | null;
};

export type AuthorOfYear = { id: number; name: string; totalPages: number } | null;

export type TopBookOfYear = { book_id: number; title: string } & RankBadge;

export type BookOfTheYear = { year: number; title: string; author: string | null; book_id: number | null } | null;

export type ShelfPick = { book_id: number; title: string; author: string | null; cover_url: string | null } | null;
