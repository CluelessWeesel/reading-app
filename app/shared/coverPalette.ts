// Muted, warm gradient pairs standing in for real cover art. Picked
// deterministically from the title so the same book always looks the same.
// Kept as Tailwind's built-in color scale (with its own dark: variants)
// rather than theme tokens -- this is a deliberately varied, decorative
// per-book palette, not part of the app's single light/dark UI theme.
export const COVER_PALETTE = [
  "from-rose-200 to-rose-300 dark:from-rose-950 dark:to-rose-900",
  "from-amber-200 to-amber-300 dark:from-amber-950 dark:to-amber-900",
  "from-emerald-200 to-emerald-300 dark:from-emerald-950 dark:to-emerald-900",
  "from-sky-200 to-sky-300 dark:from-sky-950 dark:to-sky-900",
  "from-violet-200 to-violet-300 dark:from-violet-950 dark:to-violet-900",
  "from-stone-300 to-stone-400 dark:from-stone-800 dark:to-stone-900",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function coverGradient(title: string): string {
  return COVER_PALETTE[hashString(title) % COVER_PALETTE.length];
}
