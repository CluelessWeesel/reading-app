import { MAX_TIER_ORDER, TIER_ORDER } from "../movementMath";
import { PLACEABLE_TIERS } from "../types";
import type { TierId } from "../types";
import type { TierStatBook } from "./types";

export type ScoreBand = { min: number; max: number; label: string };

// Widest reasonable score range (0.5-5.0, the same bounds as
// predicted_score's check constraint) split into five one-point bands
// (min, max] -- ordered highest first so the grid's top row is the best
// scores. Labels are offset by 0.1 (score is numeric(3,1), so 0.1 is the
// smallest possible gap) so adjacent bands never share a boundary number --
// "4-5" stacked over "3-4" left it ambiguous which row a score of exactly
// 4.0 belonged to; "4.1-5.0" over "3.1-4.0" doesn't.
export const SCORE_BANDS: ScoreBand[] = [
  { min: 4, max: 5, label: "4.1-5.0" },
  { min: 3, max: 4, label: "3.1-4.0" },
  { min: 2, max: 3, label: "2.1-3.0" },
  { min: 1, max: 2, label: "1.1-2.0" },
  { min: 0, max: 1, label: "0.1-1.0" },
];

function bandFor(score: number): ScoreBand {
  for (const band of SCORE_BANDS) {
    if (score > band.min && score <= band.max) return band;
  }
  return SCORE_BANDS[SCORE_BANDS.length - 1];
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export type GridCell = { tier: TierId; band: ScoreBand; count: number; agreement: number | null; books: TierStatBook[] };

export type ScoreTierGrid = {
  columns: TierId[]; // worst -> best, left to right
  rows: ScoreBand[]; // best -> worst, top to bottom
  cells: GridCell[][]; // cells[rowIndex][colIndex]
  excluded: number;
};

// Per-cell "agreement" is the mean, over that cell's books, of how close
// the book's tier ordinal and its raw score sit on the same 0-1 scale --
// 1 = tier and score picked the same spot, 0 = as far apart as the scales
// allow. Distinct from computeDisagreements' rank-based percentile (which
// drives the headline number and the two-column list): a heat-grid needs a
// value that's stable per-cell regardless of how many other books share
// that score, so it uses the score's raw position in its fixed range
// instead of a rank that shifts as books enter/leave scope.
export function computeScoreTierGrid(books: TierStatBook[]): ScoreTierGrid {
  // Holding has no tier judgment to agree or disagree with a score -- it's
  // excluded entirely rather than shown as a column that always reads as
  // "wrong" regardless of the score.
  const scored = books.filter((b): b is TierStatBook & { score: number } => b.score != null && b.tier !== "holding");
  const columns: TierId[] = [...PLACEABLE_TIERS].reverse();
  const rows = SCORE_BANDS;

  const cellMap = new Map<string, GridCell>();
  for (const tier of columns) {
    for (const band of rows) cellMap.set(`${tier}|${band.label}`, { tier, band, count: 0, agreement: null, books: [] });
  }

  for (const b of scored) {
    const band = bandFor(b.score);
    const cell = cellMap.get(`${b.tier}|${band.label}`)!;
    cell.books.push(b);
    cell.count++;
  }

  for (const cell of cellMap.values()) {
    if (cell.books.length === 0) continue;
    const tierNorm = TIER_ORDER[cell.tier] / MAX_TIER_ORDER;
    const sum = cell.books.reduce((acc, b) => {
      const scoreNorm = clamp01(((b.score as number) - 0.5) / 4.5);
      return acc + (1 - Math.abs(tierNorm - scoreNorm));
    }, 0);
    cell.agreement = sum / cell.books.length;
  }

  const cells = rows.map((band) => columns.map((tier) => cellMap.get(`${tier}|${band.label}`)!));
  return { columns, rows, cells, excluded: books.length - scored.length };
}
