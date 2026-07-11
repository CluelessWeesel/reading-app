export type CurrentBookForLog = {
  book_id: number;
  position: number;
  title: string;
  author: string | null;
  format_type: string | null;
  page_count: number | null;
  cover_url: string | null;
  date_started: string | null;
  last_log_date: string | null;
};

export type DailyReadingRow = {
  id: number;
  date: string;
  book_id: number | null;
  book_title: string | null;
  pages: number;
};
