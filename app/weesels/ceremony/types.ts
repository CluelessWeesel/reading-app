export type YearFinishedBook = {
  book_id: number;
  title: string;
  author: string;
  author_id: number | null;
  author_photo_url: string | null;
  cover_url: string | null;
  genre: string | null;
  subgenre: string | null;
  reread: boolean;
  indie: boolean | null;
  format_type: string | null;
  narrator: string | null;
  series: string | null;
  date_finished: string;
};

export type AuthorOption = {
  author_id: number;
  name: string;
  photo_url: string | null;
};

// The shape every category's candidate list is normalized to, regardless of
// whether it's really a book, an author, or a free-typed series/author pick
// -- lets the pre-flight board and reveal stage render any category
// uniformly (CoverThumb when bookId is set, AuthorPhoto when authorId is
// set, plain text otherwise).
export type EligibleCandidate = {
  key: string;
  label: string;
  sublabel: string | null;
  bookId: number | null;
  authorId: number | null;
  coverUrl: string | null;
  photoUrl: string | null;
  // Flagged via the finish ceremony's "Weesels watch?" step -- a shortlist
  // hint, not a functional inclusion (the candidate is already in the pool
  // on its own merits either way). See WatchedSuggestion for the opposite
  // case: watched but NOT auto-included.
  preStarred?: boolean;
};

// A book watched for this category that the eligibility engine didn't
// auto-include (e.g. the indie flag was never set) -- the actual payoff of
// watching mid-year, surfaced as a one-click add.
export type WatchedSuggestion = {
  bookId: number;
  title: string;
  author: string | null;
  coverUrl: string | null;
};

export type CategoryPool = {
  categoryId: number;
  categoryName: string;
  prestigeOrder: number;
  minCandidates: number;
  computedPool: EligibleCandidate[];
  // Best Series and Most Anticipated Author have nothing to compute --
  // they're pure manual entry, never auto-populated.
  isManualPick: boolean;
};

// Where a category stands right now, derived from weesel_ceremony_progress +
// weesels rows for this year -- see eligibility.ts / data.ts.
export type CategoryStatus =
  | { state: "unreviewed" }
  | { state: "confirmed-not-running" }
  | { state: "confirmed-running"; nominees: ConfirmedNominee[] }
  | { state: "revealed"; nominees: ConfirmedNominee[]; winner: ConfirmedNominee; citation: string | null };

export type ConfirmedNominee = {
  weeselId: number;
  label: string;
  sublabel: string | null;
  bookId: number | null;
  authorId: number | null;
  coverUrl: string | null;
  photoUrl: string | null;
};
