// One generator per section, each producing the "point" of the page: a
// plain-English sentence, not just paired numbers. Every function takes
// primitive inputs (numbers/labels) rather than full section data shapes,
// so a section only has to extract the couple of values its verdict
// actually needs and stays decoupled from how the sentence gets built.

import type { GenreSlice } from "../../home/genreDietMath";
import type { LeaderboardEntry } from "../leaderboardMath";

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString();
}

function fmtSigned(n: number): string {
  return `${n >= 0 ? "+" : ""}${fmtNum(n)}`;
}

// Population std dev -- consistent with "rating spread," not a sample
// estimate of some larger population (a year's scores ARE the population
// being described, not a sample of one).
export function stddev(values: number[]): number | null {
  if (values.length === 0) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ---------- Volume ----------

export function computeVolumeVerdict(input: {
  leftLabel: string;
  rightLabel: string;
  leftBooks: number;
  rightBooks: number;
  leftPages: number;
  rightPages: number;
  leftWords: number;
  rightWords: number;
}): string {
  const { leftLabel, rightLabel, leftBooks, rightBooks, leftPages, rightPages, leftWords, rightWords } = input;
  const bookDelta = leftBooks - rightBooks;
  const wordDelta = leftWords - rightWords;

  if (bookDelta === 0 && leftPages === rightPages) return `${leftLabel} and ${rightLabel} read almost identically.`;

  const bookWinner = bookDelta >= 0 ? leftLabel : rightLabel;
  const bookLoser = bookDelta >= 0 ? rightLabel : leftLabel;
  const bookGap = Math.abs(bookDelta);

  // Split decision: one side read more books, the other more words --
  // worth calling out that the difference is book length, not stamina.
  if (bookDelta !== 0 && wordDelta !== 0 && Math.sign(bookDelta) !== Math.sign(wordDelta)) {
    const wordWinner = wordDelta >= 0 ? leftLabel : rightLabel;
    const wordGap = Math.abs(wordDelta);
    return `${bookWinner} read ${bookGap} more book${bookGap === 1 ? "" : "s"}, but ${wordWinner} read ${fmtNum(wordGap)} more words — longer books.`;
  }

  const pageDelta = Math.abs(leftPages - rightPages);
  return bookGap > 0
    ? `${bookWinner} read ${bookGap} more book${bookGap === 1 ? "" : "s"} than ${bookLoser}, ${fmtNum(pageDelta)} more pages in all.`
    : `${leftLabel} and ${rightLabel} finished the same number of books, but ${leftPages > rightPages ? leftLabel : rightLabel} logged ${fmtNum(pageDelta)} more pages.`;
}

// ---------- Pace ----------

export function computePaceVerdict(input: {
  leftLabel: string;
  rightLabel: string;
  leftPagesPerDay: number;
  rightPagesPerDay: number;
  leftBestWeekday: string | null;
  rightBestWeekday: string | null;
}): string {
  const { leftLabel, rightLabel, leftPagesPerDay, rightPagesPerDay, leftBestWeekday, rightBestWeekday } = input;
  const delta = leftPagesPerDay - rightPagesPerDay;
  const faster = delta >= 0 ? leftLabel : rightLabel;
  const slower = delta >= 0 ? rightLabel : leftLabel;
  const gap = Math.abs(delta);

  const tempo =
    gap < 0.5
      ? `${leftLabel} and ${rightLabel} kept almost the same pace`
      : `${faster} read at a faster clip than ${slower} — ${Math.max(leftPagesPerDay, rightPagesPerDay).toFixed(1)} vs ${Math.min(leftPagesPerDay, rightPagesPerDay).toFixed(1)} pages/day`;

  if (leftBestWeekday && rightBestWeekday && leftBestWeekday !== rightBestWeekday) {
    return `${tempo}, and the best reading day shifted from ${leftBestWeekday} to ${rightBestWeekday}.`;
  }
  if (leftBestWeekday && leftBestWeekday === rightBestWeekday) {
    return `${tempo}. ${leftBestWeekday} stayed the strongest day both times.`;
  }
  return `${tempo}.`;
}

// ---------- Taste ----------

export function computeTasteVerdict(input: {
  leftLabel: string;
  rightLabel: string;
  leftMean: number | null;
  rightMean: number | null;
  leftStddev: number | null;
  rightStddev: number | null;
}): string {
  const { leftLabel, rightLabel, leftMean, rightMean, leftStddev, rightStddev } = input;
  if (leftMean == null || rightMean == null) return "Not enough scored books in one of these to compare taste.";

  const delta = leftMean - rightMean;
  const base =
    Math.abs(delta) < 0.05
      ? `${leftLabel} and ${rightLabel} graded almost identically — ${leftMean.toFixed(2)} vs ${rightMean.toFixed(2)} average.`
      : delta > 0
        ? `${leftLabel} was the more generous grader — ${leftMean.toFixed(2)} average vs ${rightLabel}'s ${rightMean.toFixed(2)}.`
        : `${rightLabel} was the more generous grader — ${rightMean.toFixed(2)} average vs ${leftLabel}'s ${leftMean.toFixed(2)}.`;

  if (leftStddev != null && rightStddev != null && Math.abs(leftStddev - rightStddev) >= 0.15) {
    const tighter = leftStddev < rightStddev ? leftLabel : rightLabel;
    return `${base} ${tighter} also rated more consistently, clustered tighter around its average.`;
  }
  return base;
}

// ---------- Genre & era ----------

export type GenreShift = { genre: string; leftPercent: number; rightPercent: number; delta: number };

// Net new -- no existing feature diffs genre share between two periods
// (RisersWidget/WinnersAndLosersWidget track author RANK movement, not
// genre proportions). Compares each genre appearing in either side's
// top-5 diet slices.
export function computeGenreShift(leftSlices: GenreSlice[], rightSlices: GenreSlice[]): { gained: GenreShift | null; lost: GenreShift | null } {
  const leftByGenre = new Map(leftSlices.map((s) => [s.genre, s.percent]));
  const rightByGenre = new Map(rightSlices.map((s) => [s.genre, s.percent]));
  const genres = new Set([...leftByGenre.keys(), ...rightByGenre.keys()]);

  const shifts: GenreShift[] = Array.from(genres).map((genre) => {
    const leftPercent = leftByGenre.get(genre) ?? 0;
    const rightPercent = rightByGenre.get(genre) ?? 0;
    return { genre, leftPercent, rightPercent, delta: rightPercent - leftPercent };
  });

  const gained = shifts.filter((s) => s.delta > 0).sort((a, b) => b.delta - a.delta)[0] ?? null;
  const lost = shifts.filter((s) => s.delta < 0).sort((a, b) => a.delta - b.delta)[0] ?? null;
  return { gained, lost };
}

export function computeGenreEraVerdict(
  shift: { gained: GenreShift | null; lost: GenreShift | null },
  leftLabel: string,
  rightLabel: string,
  leftAvgYear: number | null,
  rightAvgYear: number | null
): string {
  const parts: string[] = [];
  if (shift.gained) parts.push(`${shift.gained.genre} grew from ${shift.gained.leftPercent.toFixed(0)}% to ${shift.gained.rightPercent.toFixed(0)}%`);
  if (shift.lost) parts.push(`${shift.lost.genre} fell from ${shift.lost.leftPercent.toFixed(0)}% to ${shift.lost.rightPercent.toFixed(0)}%`);
  const genreLine = parts.length > 0 ? parts.join(", while ") : `the genre mix held steady between ${leftLabel} and ${rightLabel}`;

  if (leftAvgYear != null && rightAvgYear != null && Math.abs(rightAvgYear - leftAvgYear) >= 3) {
    const direction = rightAvgYear > leftAvgYear ? "more modern" : "further into the backlist";
    return `${genreLine}; publication years also drifted ${direction}, averaging ${Math.round(leftAvgYear)} to ${Math.round(rightAvgYear)}.`;
  }
  return `${genreLine}.`;
}

// ---------- Format ----------

export function computeFormatVerdict(input: {
  leftLabel: string;
  rightLabel: string;
  leftAudioPct: number;
  rightAudioPct: number;
}): string {
  const { leftLabel, rightLabel, leftAudioPct, rightAudioPct } = input;
  const delta = rightAudioPct - leftAudioPct;
  if (Math.abs(delta) < 5) return `${leftLabel} and ${rightLabel} leaned on audio about equally.`;
  const direction = delta > 0 ? "leaned more on audio" : "leaned less on audio";
  return `${rightLabel} ${direction} than ${leftLabel} — ${rightAudioPct.toFixed(0)}% vs ${leftAudioPct.toFixed(0)}% of books.`;
}

// ---------- Authors ----------

export function computeAuthorsCrossover(
  leftTop: LeaderboardEntry[],
  rightTop: LeaderboardEntry[],
  leftLabel: string,
  rightLabel: string
): string {
  const leftFirst = leftTop[0]?.name ?? null;
  const rightFirst = rightTop[0]?.name ?? null;
  if (!leftFirst || !rightFirst) return "Not enough author data in one of these to compare.";

  if (leftFirst === rightFirst) {
    const leftSecond = leftTop[1]?.name;
    const rightSecond = rightTop[1]?.name;
    if (leftSecond && rightSecond && leftSecond !== rightSecond) {
      return `${leftFirst} topped both ${leftLabel} and ${rightLabel}; ${rightSecond} replaced ${leftSecond} at #2.`;
    }
    return `${leftFirst} topped both ${leftLabel} and ${rightLabel}.`;
  }
  return `${leftFirst} led ${leftLabel}; ${rightFirst} took over the top spot in ${rightLabel}.`;
}

// ---------- Headline ----------

// Weighs volume (books/pages) against quality (avg score) into one
// affectionate, never-judgemental sentence -- the same split-decision
// framing as computeVolumeVerdict, but at the whole-comparison level.
export function computeHeadline(input: {
  leftLabel: string;
  rightLabel: string;
  leftBooks: number | null;
  rightBooks: number | null;
  leftPages: number | null;
  rightPages: number | null;
  leftAvgScore: number | null;
  rightAvgScore: number | null;
}): string {
  const { leftLabel, rightLabel, leftBooks, rightBooks, leftPages, rightPages, leftAvgScore, rightAvgScore } = input;

  const pagesKnown = leftPages != null && rightPages != null;
  const volumeWinner = pagesKnown && leftPages! >= rightPages! ? leftLabel : rightLabel;
  const volumeLoser = volumeWinner === leftLabel ? rightLabel : leftLabel;

  const scoresKnown = leftAvgScore != null && rightAvgScore != null;
  if (!pagesKnown && !scoresKnown) return `${leftLabel} vs ${rightLabel} — not enough data yet to call it.`;

  if (!scoresKnown) {
    return pagesKnown
      ? `${volumeWinner} read more than ${volumeLoser} — scores aren't in yet to weigh in on quality.`
      : `${leftLabel} vs ${rightLabel} is too close to call on volume alone.`;
  }

  const qualityWinner = leftAvgScore! >= rightAvgScore! ? leftLabel : rightLabel;

  if (!pagesKnown || volumeWinner === qualityWinner) {
    const winner = qualityWinner;
    const loser = winner === leftLabel ? rightLabel : leftLabel;
    const bookNote = leftBooks != null && rightBooks != null ? `, ${fmtSigned((winner === leftLabel ? leftBooks : rightBooks) - (winner === leftLabel ? rightBooks : leftBooks))} books` : "";
    return `${winner} wins across the board${bookNote} and a higher average score than ${loser}.`;
  }

  return `${volumeWinner} read more; ${qualityWinner} read better — by your own stricter standard.`;
}
