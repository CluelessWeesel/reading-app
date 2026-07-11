export type Book = {
  book_id: number;
  title: string;
  author: string;
  series: string | null;
  series_number: number | null;
  genre: string;
  year_read: number;
  year_released: number | null;
  score: number | null;
  format_type: string;
  page_count: number;
  word_count: number | null;
  date_started: string | null;
  date_finished: string | null;
  isbn: string | null;
  cover_url: string | null;
};
