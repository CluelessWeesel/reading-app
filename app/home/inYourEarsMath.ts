// Audiobook narration runs roughly 150 words/minute (~9,000 words/hour) --
// a fixed approximation, not a per-book tracked duration (this app doesn't
// track runtime), same spirit as narrators/[id]'s identical constant.
export const WORDS_PER_HOUR = 9000;

export type InYourEars = {
  hoursThisYear: number;
  hoursAllTime: number;
  topNarrator: { narratorId: number; name: string; hours: number } | null;
};

export function computeInYourEars(
  wordsThisYear: number,
  wordsAllTime: number,
  topNarratorWords: { narratorId: number; name: string; words: number } | null
): InYourEars | null {
  if (wordsAllTime <= 0) return null;
  return {
    hoursThisYear: wordsThisYear / WORDS_PER_HOUR,
    hoursAllTime: wordsAllTime / WORDS_PER_HOUR,
    topNarrator: topNarratorWords
      ? { narratorId: topNarratorWords.narratorId, name: topNarratorWords.name, hours: topNarratorWords.words / WORDS_PER_HOUR }
      : null,
  };
}
