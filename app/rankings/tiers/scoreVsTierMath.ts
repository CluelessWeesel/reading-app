import { MAX_TIER_ORDER, TIER_ORDER } from "./movementMath";
import type { TierId } from "./types";

export type ScoreVsTierRow = { book_id: number; title: string; cover_url: string | null; score: number; tier: TierId };
export type Disagreement = ScoreVsTierRow & { scorePercentile: number; tierScore: number; disagreement: number };

// Score percentile: the same rank-based "1 = best" formula used elsewhere
// (rankColor, leaderboardMath's fmtPercentile), but with tied scores
// sharing the AVERAGE of the rank positions their group spans -- scores are
// commonly tied at round values (5.0, 4.5, ...), and without averaging,
// which tied book gets the higher percentile would depend on arbitrary SQL
// row order rather than anything meaningful. Tier score: the tier's
// ordinal position normalized to the same 0-1 scale, Holding-below-D as
// always. `disagreement` is signed -- positive means the score thinks more
// of the book than its tier does, negative means the opposite -- so the
// two directions ("underrated by tier" / "overrated by tier") fall out of
// the sign rather than needing two separate computations.
export function computeDisagreements(rows: ScoreVsTierRow[]): Disagreement[] {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const total = sorted.length;

  const percentileByIndex: number[] = new Array(total);
  let i = 0;
  while (i < total) {
    let j = i;
    while (j < total && sorted[j].score === sorted[i].score) j++;
    const avgRankIndex = (i + j - 1) / 2;
    const percentile = total > 1 ? 1 - avgRankIndex / (total - 1) : 1;
    for (let k = i; k < j; k++) percentileByIndex[k] = percentile;
    i = j;
  }

  const results: Disagreement[] = sorted.map((r, idx) => {
    const tierScore = TIER_ORDER[r.tier] / MAX_TIER_ORDER;
    const scorePercentile = percentileByIndex[idx];
    return { ...r, scorePercentile, tierScore, disagreement: scorePercentile - tierScore };
  });
  return results.sort((a, b) => Math.abs(b.disagreement) - Math.abs(a.disagreement));
}
