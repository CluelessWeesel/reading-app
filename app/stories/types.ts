// The frozen deck stored in generated_stories.payload. Six generic card
// types make up the initial vocabulary -- headline, breakdown, spotlight,
// list, quote, sign-off -- deliberately generic so the same shell serves
// a monthly recap and a yearly Wrapped alike; more card types are meant to
// be added here over time as future rituals need them, same way this
// app's other systems (Weesels, home widgets) grew one round at a time.
export type HeroCardData = {
  type: "hero";
  title: string;
  subtitle: string;
  coverUrls: string[];
};

export type StatGridCardData = {
  type: "stat-grid";
  heading: string;
  stats: { label: string; value: string }[];
};

export type TopBookCardData = {
  type: "top-book";
  heading: string;
  bookId: number;
  title: string;
  author: string | null;
  authorId: number | null;
  coverUrl: string | null;
  score: number | null;
  excerpt: string | null;
};

export type RankedListCardData = {
  type: "ranked-list";
  heading: string;
  entries: { label: string; value: string; href?: string }[];
};

export type QuoteCardData = {
  type: "quote";
  text: string;
  attribution: string;
  bookId: number | null;
};

export type ClosingCardData = {
  type: "closing";
  heading: string;
  message: string;
};

// ---- Monthly recap card types -------------------------------------------
// Purpose-built for the recap document's fixed nine-section shape (see
// app/recaps). Each section's underlying compute function returns null when
// a pre-app-era month or a quiet month genuinely lacks the data for it --
// the recap viewer skips a null section outright rather than rendering an
// empty shell.

export type RecapHeaderCardData = {
  type: "recap-header";
  monthLabel: string;
  verdict: string | null; // e.g. "Your 3rd-best July of four" -- null pre-app or first-ever instance of the month
  frozenDate: string;
  coverUrls: string[]; // top covers finished this month, best-scored first
};

export type StatTilesCardData = {
  type: "stat-tiles";
  pages: number;
  pagesVsAveragePercent: number | null; // null if no other month exists yet to average against
  averagePages: number | null; // the raw average being compared against, for the comparison bar
  books: number;
  words: number;
};

export type MonthShapeCardData = {
  type: "month-shape";
  bars: { date: string; pages: number }[];
  bestDate: string | null;
  bestPages: number;
  quietCaption: string | null;
};

export type FinishedBookEntry = {
  bookId: number;
  title: string;
  author: string | null;
  authorId: number | null;
  coverUrl: string | null;
  score: number | null;
  rank: number | null; // rank within its own year_read's ranking board
  total: number | null;
};

export type MilestoneEntry = { label: string; date: string };
export type WeeselsWatchEntry = { title: string; bookId: number; category: string };

export type FinishedThisMonthCardData = {
  type: "finished-this-month";
  books: FinishedBookEntry[];
  milestones: MilestoneEntry[];
  weeselsWatch: WeeselsWatchEntry[];
};

export type PaceStat = { avgPagesPerDay: number; longestStreak: number };
export type BalanceStat = { audioSharePercent: number; comparison: string };
export type AuthorMoverStat = {
  author: string;
  authorId: number | null;
  rankBefore: number;
  rankAfter: number;
  isFaller: boolean;
};
export type PredictionsStat = { resolvedCount: number; avgAbsError: number };
export type TbrFlowStat = { added: number; finished: number; verdict: string };
export type AuthorOfMonthStat = { author: string; authorId: number | null; pages: number };

// All six of the month's "quick stat" slots in one card -- TBR flow and
// Author of the Month used to live on their own three-up row alongside
// Records Corner; folded in here since a month either has quick stats or it
// doesn't, and splitting them across two cards left both feeling sparse.
export type MonthGlanceCardData = {
  type: "month-glance";
  pace: PaceStat | null;
  balance: BalanceStat | null;
  authorMover: AuthorMoverStat | null;
  predictions: PredictionsStat | null;
  tbrFlow: TbrFlowStat | null;
  authorOfMonth: AuthorOfMonthStat | null;
};

export type RecordEntry = { label: string; detail: string };

export type RecordsCornerCardData = {
  type: "records-corner";
  entries: RecordEntry[]; // the whole card is omitted upstream if this would be empty
};

export type MonthPastBar = { year: number; pages: number; isCurrent: boolean };
export type OdometerReading = { books: number; pages: number; words: number };

export type VsMonthsPastCardData = {
  type: "vs-months-past";
  monthName: string;
  bars: MonthPastBar[];
  rank: number | null;
  total: number;
  distanceToRecordPages: number | null; // null if this month IS the record
  odometer: OdometerReading;
};

// ---- Wrapped card types -------------------------------------------------
// Purpose-built for the yearly Wrapped ritual's fixed thirteen-card shape
// (see app/wrapped). Unlike a recap (which only ever covers a fully-closed
// month), Wrapped can exist mid-year as a "projected" reading of the
// current year -- StoryPayload.final tracks that, and cards which depend on
// a projected total carry their own numbers already computed either way
// (the projection math lives in wrappedMath.ts, not in the card renderer).

export type ColdOpenCardData = {
  type: "cold-open";
  year: number;
  books: number;
  pages: number;
  words: number;
  coverUrls: string[]; // top covers finished this year, best-scored first
};

export type ScaleCardData = {
  type: "scale";
  pages: number;
  stackHeightMeters: number;
  landmarkName: string;
  landmarkHeightMeters: number;
  landmarkRatio: number; // stackHeightMeters / landmarkHeightMeters
  readingDaysThisYear: number;
};

export type YearShapeBar = { date: string; pages: number };

export type YearShapeCardData = {
  type: "year-shape";
  bars: YearShapeBar[];
  bestDate: string | null;
  bestPages: number;
  wryLine: string;
};

export type DevouringCardData = {
  type: "devouring";
  bookId: number;
  title: string;
  coverUrl: string | null;
  score: number | null;
  pagesPerDay: number;
  days: number | null;
  vsYearAveragePace: number | null; // ratio, e.g. 2.4 = 2.4x this year's average pace
};

export type AuthorOfYearRunnerUp = { author: string; authorId: number | null; pages: number };

export type AuthorOfYearCardData = {
  type: "author-of-year";
  author: string;
  authorId: number | null;
  photoUrl: string | null;
  pages: number;
  books: number;
  runnerUp: AuthorOfYearRunnerUp | null;
};

export type GenreMapSlice = { genre: string; count: number; percent: number };

export type GenreMapCardData = {
  type: "genre-map";
  slices: GenreMapSlice[];
  diagnosis: string;
};

export type PerfectScoreEntry = { bookId: number; title: string; coverUrl: string | null; author: string | null };

export type PerfectScoresCardData = {
  type: "perfect-scores";
  entries: PerfectScoreEntry[]; // empty means the drought was played straight -- see droughtLine
  droughtLine: string | null;
};

export type PodiumEntry = {
  rank: 1 | 2 | 3;
  bookId: number;
  title: string;
  coverUrl: string | null;
  score: number | null;
};

export type PodiumCardData = {
  type: "podium";
  entries: PodiumEntry[]; // rank ascending, up to 3
  closingLine: string | null; // "Weesels will have the final word" (unsealed) or the actual BOTY (sealed); null if neither resolves
};

export type PredictionEntry = { bookId: number; title: string; predicted: number; actual: number; absError: number };

export type PredictionReportCardData = {
  type: "prediction-report";
  seasonAccuracy: number;
  seasonCount: number;
  bestCall: PredictionEntry;
  biggestMiss: PredictionEntry;
};

export type RivalYearBar = { year: number; pages: number; isCurrent: boolean };

export type RivalVerdictCardData = {
  type: "rival-verdict";
  bars: RivalYearBar[];
  rank: number | null;
  total: number;
};

export type RecordStampEntry = { label: string; detail: string; emoji: string };

export type RecordsSetCardData = {
  type: "records-set";
  entries: RecordStampEntry[]; // the whole card is omitted upstream if this would be empty
};

export type OdometerTurnCardData = {
  type: "odometer-turn";
  yearNumber: number; // "year N complete" -- Nth tracked year (2023 = 1)
  yearPages: number; // this year's own contribution, for the "share of the lifetime pile" bar
  lifetimeBooks: number;
  lifetimePages: number;
  lifetimeWords: number;
};

export type EpitaphCardData = {
  type: "epitaph";
  text: string;
  attribution: string;
  coverUrl: string | null;
  bookId: number | null;
};

export type StoryCardData =
  | HeroCardData
  | StatGridCardData
  | TopBookCardData
  | RankedListCardData
  | QuoteCardData
  | ClosingCardData
  | RecapHeaderCardData
  | StatTilesCardData
  | MonthShapeCardData
  | FinishedThisMonthCardData
  | MonthGlanceCardData
  | RecordsCornerCardData
  | VsMonthsPastCardData
  | ColdOpenCardData
  | ScaleCardData
  | YearShapeCardData
  | DevouringCardData
  | AuthorOfYearCardData
  | GenreMapCardData
  | PerfectScoresCardData
  | PodiumCardData
  | PredictionReportCardData
  | RivalVerdictCardData
  | RecordsSetCardData
  | OdometerTurnCardData
  | EpitaphCardData;

export type StoryTheme = "parchment" | "night";
export type StoryMode = "stacked" | "fullscreen" | "export";

export type StoryPayload = {
  cards: StoryCardData[];
  // Wrapped-only: false while the year is still in progress and the deck was
  // generated from a Dec-1-onward projection; true once frozen from the
  // year's real final data. Absent (undefined) for recap/legacy payloads,
  // which are always as-final-as-they'll-ever-be the moment they're written.
  final?: boolean;
};

export type StoryType = "recap" | "wrapped";

export type GeneratedStory = {
  id: number;
  story_type: StoryType;
  period: string;
  payload: StoryPayload;
  generated_at: string;
  user_note: string | null;
};
