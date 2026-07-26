export type TbrEntry = {
  id: number;
  title: string;
  author: string | null;
  owned_or_format: string | null;
  word_count: number | null;
  page_count: number | null;
  subgenre: string | null;
  genre: string | null;
  cover_url: string | null;
  created_at: string;
  owned_added_at: string | null;
  unowned_added_at: string | null;
  owned: boolean | null;
  // Sealed everywhere except the TBR stats panel's "show predictions"
  // toggle -- present on every fetched entry, but the UI must never render
  // these unless that toggle is on. See app/tbr/PredictionEntry.tsx.
  predicted_score: number | null;
  predicted_margin: number | null;
  predicted_at: string | null;
};
