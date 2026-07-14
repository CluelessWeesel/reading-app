export type AuthorSummary = {
  id: number;
  name: string;
  photo_url: string | null;
  booksCount: number;
  totalPages: number;
  totalWords: number;
  avgScore: number | null;
  mostRecentFinish: string | null;
  genres: string[];
  hasQueued: boolean;
};
