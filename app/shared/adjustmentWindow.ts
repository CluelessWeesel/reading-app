// The end-of-year adjustment window runs Dec 25 -> Jan 31, covering the
// year that's either about to end (during Dec 25-31) or that just ended
// (during Jan 1-31 of the following year) -- one window per year, always
// addressed by the year it belongs to, not by which calendar year it's
// physically sitting in.
export function computeAdjustmentWindow(today: string): { year: number; isOpen: boolean } {
  const [y, m, d] = today.split("-").map(Number);
  if (m === 12 && d >= 25) return { year: y, isOpen: true };
  if (m === 1) return { year: y - 1, isOpen: true };
  // Feb .. Dec 24: this year's window hasn't opened yet, so the most
  // recent one belongs to last year, now closed.
  return { year: y - 1, isOpen: false };
}

export type EditClassification = "current" | "adjustment" | "historical";

// How an edit to a given ranking/score year should be treated right now:
//   "current"    -- the year still actively being read; unrestricted, exactly
//                    as if this feature didn't exist.
//   "adjustment" -- the just-ended year, inside its own Dec25-Jan31 window;
//                    the sanctioned path -- capped, reasoned, logged.
//   "historical" -- any other already-finalized year (including the
//                    adjustment year once its window has closed); still
//                    possible, but unusual enough to want a "you sure?"
//                    click-through rather than being silently unrestricted.
// Adjustment is checked before "current" on purpose: Dec 25-31 falls inside
// the window for the year that's ending that same calendar year, and that
// year should classify as "adjustment", not "current", during those days.
export function classifyYearEdit(year: number, today: string): EditClassification {
  const window = computeAdjustmentWindow(today);
  if (year === window.year && window.isOpen) return "adjustment";
  const currentYear = Number(today.slice(0, 4));
  if (year === currentYear) return "current";
  return "historical";
}
