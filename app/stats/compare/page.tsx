import { getStatsData } from "../getStatsData";
import { CompareView } from "./CompareView";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const data = await getStatsData();

  return (
    <CompareView
      dailyRows={data.dailyRows}
      formatDailyRows={data.formatDailyRows}
      books={data.books}
      goals={data.goals}
      tbrEntries={data.tbrEntries}
      today={data.today}
      currentYear={data.currentYear}
      years={data.years}
    />
  );
}
