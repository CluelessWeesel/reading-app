export type RightNowBook = {
  book_id: number;
  title: string;
  author: string | null;
  cover_url: string | null;
  format_type: string | null;
  page_count: number | null;
  position: number;
  date_started: string | null;
  dominant_color: string | null;
  percent: number;
  estFinish: string | null;
};
