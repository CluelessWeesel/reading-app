import { daysBetweenInclusive } from "../shared/isoDate";
import type { BookSummary } from "../stats/types";

export type FactChip = { key: string; emoji: string; label: string; value: string };

const MILESTONE_STEP = 50;

export function computeMilestoneChip(totalBooksAllTime: number): FactChip | null {
  if (totalBooksAllTime === 0) return null;
  const remainder = totalBooksAllTime % MILESTONE_STEP;
  if (remainder === 0) {
    return { key: "milestone", emoji: "🎯", label: "Milestone", value: `Just hit ${totalBooksAllTime} books!` };
  }
  const toGo = MILESTONE_STEP - remainder;
  const next = totalBooksAllTime + toGo;
  return { key: "milestone", emoji: "🎯", label: "Milestone", value: `${toGo} books to ${next}` };
}

export function computeGhostChip(oldestUnowned: { title: string; addedAt: string } | null, today: string): FactChip | null {
  if (!oldestUnowned) return null;
  const days = daysBetweenInclusive(oldestUnowned.addedAt.slice(0, 10), today) - 1;
  return { key: "ghost", emoji: "👻", label: "The Ghost", value: `"${oldestUnowned.title}" — ${days}d unwanted-but-wanted` };
}

export function computeDustAwardChip(oldestOwned: { title: string; addedAt: string } | null, today: string): FactChip | null {
  if (!oldestOwned) return null;
  const days = daysBetweenInclusive(oldestOwned.addedAt.slice(0, 10), today) - 1;
  return { key: "dust", emoji: "🕸️", label: "Dust Award", value: `"${oldestOwned.title}" — ${days}d on the shelf` };
}

export type AuthorDrought = { author: string; authorId: number | null; days: number };

// Two random authors (re-rolled per visit) and how long it's been since
// you last finished a book by each -- more interesting than one overall
// "days since any finish" number, since it points at *who* you've been
// neglecting rather than just a blank gap.
export function computeAuthorDroughts(
  books: { author: string; author_id: number | null; date_finished: string | null }[],
  today: string,
  count = 2
): AuthorDrought[] | null {
  const lastRead = new Map<string, { authorId: number | null; date: string }>();
  for (const b of books) {
    if (!b.date_finished) continue;
    const current = lastRead.get(b.author);
    if (!current || b.date_finished > current.date) lastRead.set(b.author, { authorId: b.author_id, date: b.date_finished });
  }

  const entries = Array.from(lastRead.entries());
  if (entries.length === 0) return null;

  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  return entries.slice(0, count).map(([author, info]) => ({
    author,
    authorId: info.authorId,
    days: daysBetweenInclusive(info.date, today) - 1,
  }));
}

// Pool of small, computed "deep cut" facts about the current year -- one
// picked at random per visit. Each entry is only included if its data is
// actually available, so the pool naturally shrinks on a sparse year
// rather than showing a broken/zero stat.
export function buildStatOfTheDayPool(books: BookSummary[], currentYear: number): FactChip[] {
  const thisYear = books.filter((b) => b.date_finished?.startsWith(String(currentYear)));
  const pool: FactChip[] = [];

  const withPages = thisYear.filter((b) => b.page_count > 0);
  if (withPages.length > 0) {
    const longest = withPages.reduce((a, b) => (b.page_count > a.page_count ? b : a));
    pool.push({
      key: "longest-book",
      emoji: "📖",
      label: "Stat of the day",
      value: `Longest this year: "${longest.title}" at ${longest.page_count.toLocaleString()} pages`,
    });
    const avgPages = Math.round(withPages.reduce((s, b) => s + b.page_count, 0) / withPages.length);
    pool.push({ key: "avg-length", emoji: "📏", label: "Stat of the day", value: `Average book this year: ${avgPages} pages` });
  }

  const genres = new Set(thisYear.map((b) => b.genre).filter(Boolean));
  if (genres.size > 0) {
    pool.push({ key: "genre-spread", emoji: "🎭", label: "Stat of the day", value: `${genres.size} different genres this year` });
  }

  const audio = thisYear.filter((b) => b.format_type === "audio");
  if (thisYear.length > 0 && audio.length > 0) {
    const pct = Math.round((audio.length / thisYear.length) * 100);
    pool.push({ key: "audio-share", emoji: "🎧", label: "Stat of the day", value: `${pct}% of this year was audio` });
  }

  const withPace = thisYear.filter((b) => b.date_started && b.date_finished);
  if (withPace.length > 0) {
    const fastest = withPace.reduce((a, b) => {
      const daysA = daysBetweenInclusive(a.date_started as string, a.date_finished as string);
      const daysB = daysBetweenInclusive(b.date_started as string, b.date_finished as string);
      return daysB < daysA ? b : a;
    });
    const days = daysBetweenInclusive(fastest.date_started as string, fastest.date_finished as string);
    pool.push({ key: "fastest", emoji: "⚡", label: "Stat of the day", value: `Fastest this year: "${fastest.title}" in ${days}d` });
  }

  return pool;
}
