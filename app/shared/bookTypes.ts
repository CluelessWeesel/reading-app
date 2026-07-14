// author/genre/format_raw/format_type/page_count/year_read are nullable at
// the DB level (relaxed for the "start a book" flow, which fills in only
// what's known and leaves the rest until a book is finished) -- reflected
// here as optional so currently-reading books can't silently violate the
// type. /library's own query only ever returns fully-populated books, so
// existing library code is unaffected in practice.
export type Book = {
  book_id: number;
  title: string;
  author: string | null;
  author_id: number | null;
  series: string | null;
  series_number: number | null;
  genre: string | null;
  subgenre: string | null;
  year_read: number | null;
  year_released: number | null;
  score: number | null;
  format_raw: string | null;
  format_type: string | null;
  page_count: number | null;
  word_count: number | null;
  narrator: string | null;
  reread: boolean;
  date_started: string | null;
  date_finished: string | null;
  isbn: string | null;
  status: string | null;
  cover_url: string | null;
  review: string | null;
  predicted_score: number | null;
  predicted_margin: number | null;
  legacy_notes: string | null;
  indie: boolean | null;
};
