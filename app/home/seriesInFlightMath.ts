export type SeriesInFlight = { series: string; rank: number };

// "In flight" = status_flag = 'Not Complete' on the series_rankings board
// (the same C/NC/U tags shown on /rankings) -- a real, curated signal for
// "started but not finished," rather than guessing from recency the way
// an earlier version of this widget did. Which topN show is now a random
// sample of all NC series (re-rolled per visit, same spirit as Stat of the
// Day), not always the same highest-ranked ones -- rank is still shown per
// series, just not used to pick which ones appear.
export function computeSeriesInFlight(
  rows: { series: string; rank: number; status_flag: string }[],
  topN = 5
): SeriesInFlight[] | null {
  const inFlight = rows.filter((r) => r.status_flag === "Not Complete").map((r) => ({ series: r.series, rank: r.rank }));
  if (inFlight.length === 0) return null;

  // Fisher-Yates shuffle, then take the first topN.
  for (let i = inFlight.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [inFlight[i], inFlight[j]] = [inFlight[j], inFlight[i]];
  }
  return inFlight.slice(0, topN);
}
