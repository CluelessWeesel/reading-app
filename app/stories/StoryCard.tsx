import { forwardRef } from "react";
import { HeroCard } from "./cards/HeroCard";
import { StatGridCard } from "./cards/StatGridCard";
import { TopBookCard } from "./cards/TopBookCard";
import { RankedListCard } from "./cards/RankedListCard";
import { QuoteCard } from "./cards/QuoteCard";
import { ClosingCard } from "./cards/ClosingCard";
import { RecapHeaderCard } from "./cards/RecapHeaderCard";
import { StatTilesCard } from "./cards/StatTilesCard";
import { MonthShapeCard } from "./cards/MonthShapeCard";
import { FinishedThisMonthCard } from "./cards/FinishedThisMonthCard";
import { MonthGlanceCard } from "./cards/MonthGlanceCard";
import { RecordsCornerCard } from "./cards/RecordsCornerCard";
import { VsMonthsPastCard } from "./cards/VsMonthsPastCard";
import { ColdOpenCard } from "./cards/ColdOpenCard";
import { ScaleCard } from "./cards/ScaleCard";
import { YearShapeCard } from "./cards/YearShapeCard";
import { DevouringCard } from "./cards/DevouringCard";
import { AuthorOfYearCard } from "./cards/AuthorOfYearCard";
import { GenreMapCard } from "./cards/GenreMapCard";
import { PerfectScoresCard } from "./cards/PerfectScoresCard";
import { PodiumCard } from "./cards/PodiumCard";
import { PredictionReportCard } from "./cards/PredictionReportCard";
import { RivalVerdictCard } from "./cards/RivalVerdictCard";
import { RecordsSetCard } from "./cards/RecordsSetCard";
import { OdometerTurnCard } from "./cards/OdometerTurnCard";
import { EpitaphCard } from "./cards/EpitaphCard";
import type { StoryCardData, StoryMode, StoryTheme } from "./types";

function CardContent({ card, mode }: { card: StoryCardData; mode: StoryMode }) {
  switch (card.type) {
    case "hero":
      return <HeroCard card={card} />;
    case "stat-grid":
      return <StatGridCard card={card} />;
    case "top-book":
      return <TopBookCard card={card} />;
    case "ranked-list":
      return <RankedListCard card={card} />;
    case "quote":
      return <QuoteCard card={card} />;
    case "closing":
      return <ClosingCard card={card} />;
    case "recap-header":
      return <RecapHeaderCard card={card} />;
    case "stat-tiles":
      return <StatTilesCard card={card} />;
    case "month-shape":
      return <MonthShapeCard card={card} />;
    case "finished-this-month":
      return <FinishedThisMonthCard card={card} />;
    case "month-glance":
      return <MonthGlanceCard card={card} />;
    case "records-corner":
      return <RecordsCornerCard card={card} />;
    case "vs-months-past":
      return <VsMonthsPastCard card={card} />;
    case "cold-open":
      return <ColdOpenCard card={card} mode={mode} />;
    case "scale":
      return <ScaleCard card={card} />;
    case "year-shape":
      return <YearShapeCard card={card} />;
    case "devouring":
      return <DevouringCard card={card} />;
    case "author-of-year":
      return <AuthorOfYearCard card={card} />;
    case "genre-map":
      return <GenreMapCard card={card} />;
    case "perfect-scores":
      return <PerfectScoresCard card={card} />;
    case "podium":
      return <PodiumCard card={card} mode={mode} />;
    case "prediction-report":
      return <PredictionReportCard card={card} />;
    case "rival-verdict":
      return <RivalVerdictCard card={card} />;
    case "records-set":
      return <RecordsSetCard card={card} />;
    case "odometer-turn":
      return <OdometerTurnCard card={card} />;
    case "epitaph":
      return <EpitaphCard card={card} />;
  }
}

// stacked = a bounded section within a scrolling document; fullscreen =
// fills its parent (StoryFullscreen sizes that parent to the viewport);
// export = fixed real dimensions (a social "story" aspect, 1080x1920) so a
// captured PNG always comes out the same shape regardless of the viewing
// device -- see StoryExport for how that capture happens.
export const EXPORT_WIDTH = 1080;
export const EXPORT_HEIGHT = 1920;

const MODE_CONTAINER_CLASS: Record<StoryMode, string> = {
  stacked: "relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-gold shadow-lg",
  fullscreen: "relative h-full w-full",
  export: "relative overflow-hidden",
};

const MODE_MIN_HEIGHT: Partial<Record<StoryMode, string>> = {
  stacked: "560px",
};

export const StoryCard = forwardRef<
  HTMLDivElement,
  { card: StoryCardData; theme: StoryTheme; mode: StoryMode }
>(function StoryCard({ card, theme, mode }, ref) {
  const themeClass = theme === "night" ? "story-theme-night" : "story-theme-parchment";

  return (
    <div
      ref={ref}
      className={`story-card-bg ${themeClass} ${MODE_CONTAINER_CLASS[mode]} text-ink-warm`}
      style={
        mode === "export"
          ? { width: EXPORT_WIDTH, height: EXPORT_HEIGHT }
          : MODE_MIN_HEIGHT[mode]
            ? { minHeight: MODE_MIN_HEIGHT[mode] }
            : undefined
      }
    >
      <div className="flex h-full w-full flex-col p-8 sm:p-12">
        <CardContent card={card} mode={mode} />
      </div>
    </div>
  );
});
