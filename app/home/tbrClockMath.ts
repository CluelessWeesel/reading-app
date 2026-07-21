import { addIsoDays } from "../shared/isoDate";

export type TbrClock = { daysRemaining: number; runOutDate: string; pagesRemaining: number };

// How long the *owned* TBR pile lasts at the current reading pace -- not
// the whole TBR list, since unowned books aren't actually next in line to
// read yet.
export function computeTbrClock(ownedPagesRemaining: number, pagesPerDay: number, today: string): TbrClock | null {
  if (ownedPagesRemaining <= 0 || pagesPerDay <= 0) return null;
  const daysRemaining = Math.round(ownedPagesRemaining / pagesPerDay);
  return { daysRemaining, runOutDate: addIsoDays(today, daysRemaining), pagesRemaining: ownedPagesRemaining };
}
