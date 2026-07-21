import { daysBetweenInclusive } from "../shared/isoDate";

export type Countdown = { label: string; daysUntil: number; isNow: boolean };

function monthDay(iso: string): string {
  return iso.slice(5); // "MM-DD"
}

// Wrapped always lands on Jan 1 -- whichever Jan 1 is next.
function nextWrapped(today: string): string {
  const year = Number(today.slice(0, 4));
  const thisYear = `${year}-01-01`;
  return today <= thisYear ? thisYear : `${year + 1}-01-01`;
}

// Weesels season spans New Year's itself (Dec 25 -> Jan 7), so "next
// occurrence" depends on where today falls relative to that wraparound:
//   Jan 8 - Dec 24  -> season hasn't started yet, starts this Dec 25
//   Dec 25 - Dec 31 -> already started (this Dec 25), ends next Jan 7
//   Jan 1 - Jan 7   -> still ongoing (from last Dec 25), ends this Jan 7
function weeselsWindow(today: string): { start: string; end: string } {
  const year = Number(today.slice(0, 4));
  const md = monthDay(today);

  if (md >= "01-01" && md <= "01-07") {
    return { start: `${year - 1}-12-25`, end: `${year}-01-07` };
  }
  if (md >= "12-25" && md <= "12-31") {
    return { start: `${year}-12-25`, end: `${year + 1}-01-07` };
  }
  return { start: `${year}-12-25`, end: `${year + 1}-01-07` };
}

export function computeCountdowns(today: string): { wrapped: Countdown; weesels: Countdown } {
  const wrappedDate = nextWrapped(today);
  const wrapped: Countdown = {
    label: "Wrapped",
    daysUntil: today === wrappedDate ? 0 : daysBetweenInclusive(today, wrappedDate) - 1,
    isNow: today === wrappedDate,
  };

  const { start, end } = weeselsWindow(today);
  const inSeason = today >= start && today <= end;
  const weesels: Countdown = {
    label: "Weesels",
    daysUntil: inSeason ? 0 : daysBetweenInclusive(today, start) - 1,
    isNow: inSeason,
  };

  return { wrapped, weesels };
}
