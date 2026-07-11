export type TbrEntry = {
  id: number;
  title: string;
  author: string | null;
  owned_or_format: string | null;
  word_count: number | null;
  subgenre: string | null;
  genre: string | null;
  cover_url: string | null;
  created_at: string;
};
