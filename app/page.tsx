import { pool } from "@/lib/db";
import { addIsoDays, daysBetweenInclusive, todayLocalIso } from "./shared/isoDate";
import { estimateFinishDate, percentComplete } from "./home/homeMath";
import { HomeHeader } from "./home/HomeHeader";
import { TwinAltars } from "./home/TwinAltars";
import { Section } from "./home/widgets/Section";
import { RhythmRibbon } from "./home/widgets/RhythmRibbon";
import { RivalWidget } from "./home/widgets/RivalWidget";
import { AmongTheYearsWidget } from "./home/widgets/AmongTheYearsWidget";
import { TbrClockWidget } from "./home/widgets/TbrClockWidget";
import { FiveStarDroughtWidget } from "./home/widgets/FiveStarDroughtWidget";
import { VelocityGaugeWidget } from "./home/widgets/VelocityGaugeWidget";
import { CountdownsWidget } from "./home/widgets/CountdownsWidget";
import { InYourEarsWidget } from "./home/widgets/InYourEarsWidget";
import { computeInYourEars } from "./home/inYourEarsMath";
import { WeekdayFingerprintWidget } from "./home/widgets/WeekdayFingerprintWidget";
import { computeWeekdayFingerprint } from "./home/weekdayFingerprintMath";
import { MetronomeWidget } from "./home/widgets/MetronomeWidget";
import { computeMetronome } from "./home/metronomeMath";
import { BalanceWidget } from "./home/widgets/BalanceWidget";
import { computeBalance } from "./home/balanceMath";
import { computeRhythm } from "./home/rhythmMath";
import { computeRival } from "./home/rivalMath";
import { computeAmongTheYears } from "./home/amongYearsMath";
import { computeTbrClock } from "./home/tbrClockMath";
import { computeFiveStarDrought } from "./home/fiveStarDroughtMath";
import { computeVelocity } from "./home/velocityMath";
import { computeCountdowns } from "./home/countdownMath";
import { MemoryFeatureGroup } from "./home/widgets/MemoryFeatureGroup";
import { GenreDietWidget, GENRE_DIET_SIZE } from "./home/widgets/GenreDietWidget";
import { PredictionWatchWidget } from "./home/widgets/PredictionWatchWidget";
import { RisersWidget, RISERS_SIZE } from "./home/widgets/RisersWidget";
import { WinnersAndLosersWidget } from "./home/widgets/WinnersAndLosersWidget";
import { SeriesInFlightWidget } from "./home/widgets/SeriesInFlightWidget";
import { ForecastWidget } from "./home/widgets/ForecastWidget";
import { ThisWeekWidget } from "./home/widgets/ThisWeekWidget";
import { OdometerBand } from "./home/widgets/OdometerBand";
import { FactChipsRow } from "./home/widgets/FactChipsRow";
import { excerpt, computeOnThisDay, computeAnniversaries } from "./home/memoryMath";
import type { MemoryPen } from "./home/memoryMath";
import { computePredictionWatch } from "./home/predictionWatchMath";
import { computeRisersForMetric, computeWinnersAndLosers } from "./home/risersMath";
import { buildAuthorIdMap } from "./stats/leaderboardMath";
import { computeSeriesInFlight } from "./home/seriesInFlightMath";
import { computeForecast } from "./home/forecastMath";
import { computeThisWeek } from "./home/thisWeekMath";
import type { RankMove } from "./home/thisWeekMath";
import {
  computeMilestoneChip,
  computeGhostChip,
  computeDustAwardChip,
  computeAuthorDroughts,
  buildStatOfTheDayPool,
} from "./home/factChipsMath";
import { computeGenreDiet, computeIdleGenreFact } from "./home/genreDietMath";
import { SERIES_LIST_NAMES } from "./rankings/types";
import { buildYearSeriesByDayOfYear, computeScopeData } from "./stats/statsMath";
import type { BookSummary, DailyRow, Goal } from "./stats/types";
import type { RightNowBook } from "./home/types";
import { ensureLatestRecapGenerated, lastCompletedMonth } from "./stories/ensureRecap";
import { RecapBanner } from "./stories/RecapBanner";
import { ensureWrappedGenerated } from "./stories/ensureWrapped";
import { WrappedBanner } from "./stories/WrappedBanner";

export const dynamic = "force-dynamic";

const START_DATE = "2023-01-01";
const YEARS = [2023, 2024, 2025, 2026];

async function getDailyRows(today: string): Promise<DailyRow[]> {
  const { rows } = await pool.query<DailyRow>(
    `select to_char(date, 'YYYY-MM-DD') as date, sum(pages)::int as pages
     from daily_reading
     where date between $1 and $2
     group by date
     order by date asc`,
    [START_DATE, today]
  );
  return rows;
}

// Only 25 of ~1300 daily_reading rows carry a book_id (the rest are legacy
// whole-house entries with no per-book attribution) -- The Balance widget
// uses this for whichever months DO have it, degrading to finishes-based
// figures for every other month. Same shape as stats/page.tsx's own
// getFormatDailyRows.
async function getFormatDailyRows(): Promise<{ date: string; pages: number; format_type: string | null; format_raw: string | null }[]> {
  const { rows } = await pool.query<{ date: string; pages: number; format_type: string | null; format_raw: string | null }>(
    `select to_char(dr.date, 'YYYY-MM-DD') as date, dr.pages, b.format_type, b.format_raw
     from daily_reading dr
     join books b on b.book_id = dr.book_id
     where dr.book_id is not null`
  );
  return rows;
}

async function getBooks(): Promise<Omit<BookSummary, "percentile" | "ratingsCount" | "promptAnswersCount">[]> {
  const { rows } = await pool.query<Omit<BookSummary, "percentile" | "ratingsCount" | "promptAnswersCount">>(
    `select book_id, title, cover_url, year_read, author, author_id::int as author_id, series, genre, subgenre, narrator,
            year_released, page_count, format_type, format_raw, review,
            word_count::float8 as word_count, score::float8 as score,
            avg_pages_per_day::float8 as avg_pages_per_day,
            to_char(date_started, 'YYYY-MM-DD') as date_started,
            to_char(date_finished, 'YYYY-MM-DD') as date_finished
     from books`
  );
  return rows;
}

// Same formula as /stats' getPercentiles and the book dossier's rank-color
// gradient -- previously hardcoded to null here, which silently meant
// every avgPercentile-based computation on Home (Yearly Risers) had zero
// ranked books to work with, for every author, always.
async function getPercentiles(): Promise<Map<number, number>> {
  const { rows } = await pool.query<{ book_id: number; rank: number; total: number }>(
    `select br.book_id, br.rank, cnt.total
     from book_rankings br
     join (select list_id, count(*)::int as total from book_rankings group by list_id) cnt
       on cnt.list_id = br.list_id
     where br.book_id is not null`
  );
  const map = new Map<number, number>();
  for (const r of rows) {
    map.set(r.book_id, r.total > 1 ? 1 - (r.rank - 1) / (r.total - 1) : 1);
  }
  return map;
}

async function getGoals(): Promise<Goal[]> {
  const { rows } = await pool.query<Goal>(`select year, pages_goal from reading_goals order by year asc`);
  return rows;
}

async function getRightNowBooks(today: string): Promise<RightNowBook[]> {
  const { rows } = await pool.query<{
    book_id: number;
    title: string;
    author: string | null;
    cover_url: string | null;
    format_type: string | null;
    page_count: number | null;
    position: number;
    date_started: string | null;
    dominant_color: string | null;
  }>(
    `select b.book_id, b.title, b.author, b.cover_url, b.format_type, b.page_count,
            cb.position::float8 as position, cb.dominant_color,
            to_char(b.date_started, 'YYYY-MM-DD') as date_started
     from current_books cb
     join books b on b.book_id = cb.book_id
     order by cb.id asc`
  );
  return rows.map((b) => {
    const total = b.format_type === "audio" ? 100 : b.page_count;
    return {
      ...b,
      percent: percentComplete(b.position, total),
      estFinish: estimateFinishDate(b.position, total, b.date_started, today),
    };
  });
}

async function getTbrOwnedPagesRemaining(): Promise<number> {
  const { rows } = await pool.query<{ total: number }>(
    `select coalesce(sum(page_count), 0)::int as total from tbr where owned = true and page_count is not null`
  );
  return rows[0].total;
}

async function getRecapStoryId(period: string): Promise<number | null> {
  const { rows } = await pool.query<{ id: number }>(
    `select id from generated_stories where story_type = 'recap' and period = $1`,
    [period]
  );
  return rows[0]?.id ?? null;
}

async function getWrappedBannerInfo(year: number): Promise<{ final: boolean } | null> {
  const { rows } = await pool.query<{ payload: { final?: boolean } }>(
    `select payload from generated_stories where story_type = 'wrapped' and period = $1`,
    [String(year)]
  );
  if (rows.length === 0) return null;
  return { final: rows[0].payload.final !== false };
}

async function getInYourEarsWords(currentYear: number): Promise<{
  wordsThisYear: number;
  wordsAllTime: number;
  topNarrator: { narratorId: number; name: string; words: number } | null;
}> {
  const [totals, topNarratorRows] = await Promise.all([
    pool.query<{ this_year: number; all_time: number }>(
      `select
         coalesce(sum(word_count) filter (where date_finished >= $1), 0)::float8 as this_year,
         coalesce(sum(word_count), 0)::float8 as all_time
       from books
       where format_type = 'audio' and date_finished is not null`,
      [`${currentYear}-01-01`]
    ),
    pool.query<{ narrator_id: number; name: string; words: number }>(
      `select n.id::int as narrator_id, n.name, sum(b.word_count)::float8 as words
       from book_narrators bn
       join narrators n on n.id = bn.narrator_id
       join books b on b.book_id = bn.book_id
       where b.date_finished is not null and b.date_finished >= $1
       group by n.id, n.name
       order by words desc
       limit 1`,
      [`${currentYear}-01-01`]
    ),
  ]);
  const topRow = topNarratorRows.rows[0];
  return {
    wordsThisYear: totals.rows[0]?.this_year ?? 0,
    wordsAllTime: totals.rows[0]?.all_time ?? 0,
    topNarrator: topRow ? { narratorId: topRow.narrator_id, name: topRow.name, words: topRow.words } : null,
  };
}

async function getLastFiveStar(): Promise<{ date_finished: string; title: string } | null> {
  const { rows } = await pool.query<{ date_finished: string; title: string }>(
    `select to_char(date_finished, 'YYYY-MM-DD') as date_finished, title
     from books
     where score = 5 and date_finished is not null and date_finished >= $1
     order by date_finished desc, book_id desc
     limit 1`,
    [START_DATE]
  );
  return rows[0] ?? null;
}

async function getBooksFinishedSince(dateFinished: string): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    `select count(*)::int as count from books where date_finished is not null and date_finished > $1`,
    [dateFinished]
  );
  return rows[0].count;
}

async function getAllFiveStarDates(): Promise<string[]> {
  // Floored at START_DATE -- an old five-star from before this app tracked
  // anything would inflate the drought record with a gap that has nothing
  // to do with actual reading rhythm.
  const { rows } = await pool.query<{ date_finished: string }>(
    `select to_char(date_finished, 'YYYY-MM-DD') as date_finished
     from books
     where score = 5 and date_finished is not null and date_finished >= $1
     order by date_finished asc`,
    [START_DATE]
  );
  return rows.map((r) => r.date_finished);
}

async function getMemoryPen(): Promise<MemoryPen | null> {
  const { rows } = await pool.query<{
    book_id: number;
    title: string;
    author: string | null;
    date_finished: string;
    question: string | null;
    text: string;
  }>(
    `select * from (
       (
         select b.book_id, b.title, b.author, to_char(b.date_finished, 'YYYY-MM-DD') as date_finished,
                null::text as question, b.review as text
         from books b
         where b.review is not null and length(trim(b.review)) > 0 and b.date_finished is not null
       )
       union all
       (
         select b.book_id, b.title, b.author, to_char(b.date_finished, 'YYYY-MM-DD') as date_finished,
                p.question, pa.answer as text
         from prompt_answers pa
         join prompts p on p.id = pa.prompt_id
         join books b on b.book_id = pa.book_id
         where pa.answer is not null and length(trim(pa.answer)) > 0 and b.date_finished is not null
       )
     ) memory_candidates
     order by random()
     limit 1`
  );
  const row = rows[0];
  if (!row) return null;
  return {
    bookId: row.book_id,
    title: row.title,
    author: row.author,
    dateFinished: row.date_finished,
    question: row.question,
    text: excerpt(row.text),
  };
}

async function getFavoritePrompt(): Promise<{ question: string; count: number } | null> {
  const { rows } = await pool.query<{ question: string; count: number }>(
    `select p.question, count(*)::int as count
     from prompt_answers pa
     join prompts p on p.id = pa.prompt_id
     group by p.id, p.question
     order by count desc
     limit 1`
  );
  return rows[0] ?? null;
}

async function getSeriesRankingRows(): Promise<{ series: string; rank: number; status_flag: string }[]> {
  const { rows } = await pool.query<{ series: string; rank: number; status_flag: string }>(
    `select series, rank, status_flag from series_rankings where list_name = $1`,
    [SERIES_LIST_NAMES[0]]
  );
  return rows;
}

async function getOldestTbr(owned: boolean): Promise<{ title: string; addedAt: string } | null> {
  const dateCol = owned ? "coalesce(owned_added_at, created_at)" : "coalesce(unowned_added_at, created_at)";
  const { rows } = await pool.query<{ title: string; added_at: string }>(
    `select title, to_char(${dateCol}, 'YYYY-MM-DD') as added_at
     from tbr
     where owned = $1
     order by ${dateCol} asc
     limit 1`,
    [owned]
  );
  const row = rows[0];
  return row ? { title: row.title, addedAt: row.added_at } : null;
}

async function getRecentRankMoves(today: string): Promise<RankMove[]> {
  const { rows } = await pool.query<{ book_id: number; title: string; old_rank: number | null; new_rank: number }>(
    `select rc.book_id, b.title, rc.old_rank, rc.new_rank
     from rank_changes rc
     join books b on b.book_id = rc.book_id
     where rc.changed_at >= $1::date - interval '7 days'
     order by rc.changed_at desc
     limit 5`,
    [today]
  );
  return rows.map((r) => ({ bookId: r.book_id, title: r.title, oldRank: r.old_rank, newRank: r.new_rank }));
}

async function getPredictionCandidates(): Promise<
  { book_id: number; title: string; predicted_score: number; score: number; date_finished: string }[]
> {
  // All-time, not just this year -- the manual prediction feature may not
  // have been used yet in the current year even if it has older data.
  const { rows } = await pool.query<{
    book_id: number;
    title: string;
    predicted_score: number;
    score: number;
    date_finished: string;
  }>(
    `select book_id, title, predicted_score::float8 as predicted_score, score::float8 as score,
            to_char(date_finished, 'YYYY-MM-DD') as date_finished
     from books
     where predicted_score is not null and score is not null and date_finished is not null
     order by date_finished desc`
  );
  return rows;
}

export default async function HomePage() {
  const today = todayLocalIso();
  const currentYear = Number(today.slice(0, 4));

  // Awaited on its own, before the recap-id/Wrapped-banner lookups below,
  // so the very first home load of a new month (or of December) generates
  // that recap/Wrapped in time to also see it exist -- both living in the
  // same Promise.all would race and could show a blank banner on day 1
  // depending on which settled first.
  await ensureLatestRecapGenerated(today);
  await ensureWrappedGenerated(today);

  const [
    dailyRows,
    formatDailyRows,
    bookRows,
    goals,
    rightNowBooks,
    tbrOwnedPagesRemaining,
    inYourEarsWords,
    lastFiveStar,
    allFiveStarDates,
    memoryPen,
    favoritePrompt,
    oldestUnowned,
    oldestOwned,
    recentRankMoves,
    predictionCandidates,
    seriesRankingRows,
    percentiles,
    recapStoryId,
    wrappedBannerInfo,
  ] = await Promise.all([
    getDailyRows(today),
    getFormatDailyRows(),
    getBooks(),
    getGoals(),
    getRightNowBooks(today),
    getTbrOwnedPagesRemaining(),
    getInYourEarsWords(currentYear),
    getLastFiveStar(),
    getAllFiveStarDates(),
    getMemoryPen(),
    getFavoritePrompt(),
    getOldestTbr(false),
    getOldestTbr(true),
    getRecentRankMoves(today),
    getPredictionCandidates(),
    getSeriesRankingRows(),
    getPercentiles(),
    getRecapStoryId(lastCompletedMonth(today)),
    getWrappedBannerInfo(currentYear),
  ]);

  const books: BookSummary[] = bookRows.map((b) => ({
    ...b,
    percentile: percentiles.get(b.book_id) ?? null,
    ratingsCount: 0,
    promptAnswersCount: 0,
  }));

  const onThisDay = computeOnThisDay(books, today, currentYear);
  const anniversaries = computeAnniversaries(books, today, currentYear);

  const booksFinishedSince = lastFiveStar ? await getBooksFinishedSince(lastFiveStar.date_finished) : 0;

  const currentYearData = computeScopeData({
    scope: { kind: "year", year: currentYear },
    today,
    currentYear,
    dailyRows,
    formatDailyRows: [],
    books,
    goals,
  });

  // Lifetime ("all") totals -- computed here (not just once, further down,
  // near the Odometer band) since The Metronome's cruise line also needs
  // lifetimeData.pagesPerDay.
  const lifetimeData = computeScopeData({
    scope: { kind: "all" },
    today,
    currentYear,
    dailyRows,
    formatDailyRows: [],
    books,
    goals,
  });

  // THE RHYTHM section's data. Each compute* function returns null when
  // there's nothing meaningful to show, and the widget components
  // themselves also bail out on null -- belt and suspenders, since the
  // items array below already drops falsy entries before layout.
  const rhythm = computeRhythm(dailyRows, today);
  const rival = computeRival(dailyRows, currentYear, today);
  const amongTheYears = computeAmongTheYears(dailyRows, YEARS, currentYear, today);
  const tbrClock = computeTbrClock(tbrOwnedPagesRemaining, currentYearData.pagesPerDay, today);
  const inYourEars = computeInYourEars(
    inYourEarsWords.wordsThisYear,
    inYourEarsWords.wordsAllTime,
    inYourEarsWords.topNarrator
  );
  const weekdayFingerprintByYear = Object.fromEntries(
    YEARS.map((y) => [y, computeWeekdayFingerprint(dailyRows, y)])
  );
  const metronome = computeMetronome(dailyRows, lifetimeData.pagesPerDay, today);
  const balanceByWindow = computeBalance(books, formatDailyRows, today);
  const fiveStarDrought = computeFiveStarDrought(
    lastFiveStar?.date_finished ?? null,
    lastFiveStar?.title ?? null,
    booksFinishedSince,
    allFiveStarDates,
    today
  );
  const daysInYear = daysBetweenInclusive(`${currentYear}-01-01`, `${currentYear}-12-31`);
  const priorYearFullSeries = buildYearSeriesByDayOfYear(dailyRows, currentYear - 1);
  const priorYearTotal = priorYearFullSeries[priorYearFullSeries.length - 1]?.y ?? 0;
  const priorYearAvgPace = priorYearTotal > 0 ? priorYearTotal / priorYearFullSeries.length : null;
  const velocity = computeVelocity(
    currentYearData.pagesPerDay,
    currentYearData.goal,
    daysInYear,
    priorYearAvgPace
  );
  const { weesels, wrapped } = computeCountdowns(today);

  // MEMORY + THE SEASON's data.
  const dietByWindow = {
    "3": computeGenreDiet(books, addIsoDays(today, -91)),
    "6": computeGenreDiet(books, addIsoDays(today, -182)),
    "12": computeGenreDiet(books, addIsoDays(today, -365)),
  };
  const idleFact = computeIdleGenreFact(books, today);
  const predictionWatch = computePredictionWatch(predictionCandidates);
  const authorIdMap = buildAuthorIdMap(books);
  const risersByWindow = {
    "3": computeRisersForMetric(books, authorIdMap, addIsoDays(today, -91), "pages"),
    "6": computeRisersForMetric(books, authorIdMap, addIsoDays(today, -182), "pages"),
    "12": computeRisersForMetric(books, authorIdMap, addIsoDays(today, -365), "pages"),
  };
  // Winners and losers: rank *position* on the avgPercentile ("Consistency")
  // board, this year vs. the end of last year -- a full year-over-year
  // comparison, not a sliding window, and a different underlying metric
  // than the pages-based Risers above. Backfills with the biggest fallers
  // when there aren't 4 real winners (see computeWinnersAndLosers).
  const winnersAndLosers = computeWinnersAndLosers(books, authorIdMap, `${currentYear - 1}-12-31`, "avgPercentile");
  const seriesInFlight = computeSeriesInFlight(seriesRankingRows);
  const forecast = computeForecast(rightNowBooks);
  const weekStart = addIsoDays(today, -6);
  const finishesThisWeek = books.filter((b) => b.date_finished != null && b.date_finished >= weekStart).length;
  const thisWeek = computeThisWeek(dailyRows, recentRankMoves, finishesThisWeek, today, currentYearData.pagesPerDay);

  // Fact chips -- Stat of the Day and the author droughts both re-roll from
  // a random pick built fresh every render, so "new pick each visit" falls
  // out naturally from this being a Server Component render.
  const totalBooksAllTime = books.filter((b) => b.date_finished != null).length;
  const milestoneChip = computeMilestoneChip(totalBooksAllTime);
  const ghostChip = computeGhostChip(oldestUnowned, today);
  const dustChip = computeDustAwardChip(oldestOwned, today);
  const authorDroughts = computeAuthorDroughts(books, today);
  const statPool = buildStatOfTheDayPool(books, currentYear);
  const statOfTheDay = statPool.length > 0 ? statPool[Math.floor(Math.random() * statPool.length)] : null;

  const dayOfMonth = Number(today.slice(8, 10));
  const showRecapBanner = dayOfMonth <= 7 && recapStoryId != null;
  const isDecember = Number(today.slice(5, 7)) === 12;

  return (
    <div className="min-h-full flex-1 px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <HomeHeader streak={currentYearData.currentStreak} verdict={currentYearData.projection?.verdict ?? null} />

        {isDecember && wrappedBannerInfo != null && <WrappedBanner year={currentYear} final={wrappedBannerInfo.final} />}
        {showRecapBanner && <RecapBanner period={lastCompletedMonth(today)} />}

        <TwinAltars books={rightNowBooks} />

        <Section
          label="The rhythm"
          items={[
            rhythm && { key: "rhythm-ribbon", size: RhythmRibbon.size, node: <RhythmRibbon nights={rhythm} /> },
            rival && { key: "rival", size: RivalWidget.size, node: <RivalWidget rival={rival} currentYear={currentYear} /> },
            amongTheYears && {
              key: "among-the-years",
              size: AmongTheYearsWidget.size,
              node: <AmongTheYearsWidget years={amongTheYears} currentYear={currentYear} />,
            },
            { key: "rhythm-divider", divider: true },
            tbrClock && { key: "tbr-clock", size: TbrClockWidget.size, node: <TbrClockWidget clock={tbrClock} /> },
            fiveStarDrought && {
              key: "five-star-drought",
              size: FiveStarDroughtWidget.size,
              node: <FiveStarDroughtWidget drought={fiveStarDrought} />,
            },
            velocity && { key: "velocity", size: VelocityGaugeWidget.size, node: <VelocityGaugeWidget velocity={velocity} /> },
            { key: "countdowns", size: CountdownsWidget.size, node: <CountdownsWidget weesels={weesels} wrapped={wrapped} /> },
            inYourEars && {
              key: "in-your-ears",
              size: InYourEarsWidget.size,
              node: <InYourEarsWidget inYourEars={inYourEars} />,
            },
            Object.values(weekdayFingerprintByYear).some(Boolean) && {
              key: "weekday-fingerprint",
              size: WeekdayFingerprintWidget.size,
              node: (
                <WeekdayFingerprintWidget
                  fingerprintByYear={weekdayFingerprintByYear}
                  years={YEARS}
                  defaultYear={currentYear}
                />
              ),
            },
            metronome && {
              key: "metronome",
              size: MetronomeWidget.size,
              node: <MetronomeWidget metronome={metronome} />,
            },
            Object.values(balanceByWindow).some(Boolean) && {
              key: "balance",
              size: BalanceWidget.size,
              node: <BalanceWidget windowsByN={balanceByWindow} />,
            },
          ]}
        />

        <Section
          label="Memory"
          items={[
            (memoryPen || onThisDay.length > 0 || anniversaries.length > 0 || favoritePrompt) && {
              key: "memory-feature-group",
              size: MemoryFeatureGroup.size,
              node: (
                <MemoryFeatureGroup
                  memory={memoryPen}
                  onThisDay={onThisDay}
                  anniversaries={anniversaries}
                  favoritePrompt={favoritePrompt}
                />
              ),
            },
          ]}
        />

        <Section
          label="The season"
          items={[
            (dietByWindow["3"] || dietByWindow["6"] || dietByWindow["12"]) && {
              key: "genre-diet",
              size: GENRE_DIET_SIZE,
              node: <GenreDietWidget dietByWindow={dietByWindow} idleFact={idleFact} />,
            },
            predictionWatch && {
              key: "prediction-watch",
              size: PredictionWatchWidget.size,
              node: <PredictionWatchWidget watch={predictionWatch} />,
            },
            (risersByWindow["3"] || risersByWindow["6"] || risersByWindow["12"]) && {
              key: "risers",
              size: RISERS_SIZE,
              node: <RisersWidget risersByWindow={risersByWindow} />,
            },
            winnersAndLosers && {
              key: "winners-and-losers",
              size: WinnersAndLosersWidget.size,
              node: <WinnersAndLosersWidget movers={winnersAndLosers} />,
            },
            { key: "season-divider", divider: true },
            seriesInFlight && {
              key: "series-in-flight",
              size: SeriesInFlightWidget.size,
              node: <SeriesInFlightWidget series={seriesInFlight} />,
            },
            forecast && { key: "forecast", size: ForecastWidget.size, node: <ForecastWidget forecast={forecast} /> },
            thisWeek && { key: "this-week", size: ThisWeekWidget.size, node: <ThisWeekWidget week={thisWeek} /> },
          ]}
        />

        <OdometerBand
          totalBooks={lifetimeData.booksFinished}
          totalPages={Math.round(lifetimeData.totalPages)}
          totalWords={Math.round(lifetimeData.totalWordsEstimate)}
        />

        <FactChipsRow chips={[milestoneChip, ghostChip, dustChip, statOfTheDay]} droughts={authorDroughts} />
      </div>
    </div>
  );
}
