import { WidgetCard } from "./WidgetCard";
import { WeekdayFingerprintChart } from "./WeekdayFingerprintChart";
import type { WeekdayFingerprint } from "../weekdayFingerprintMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <rect x="3" y="10" width="2.2" height="7" rx="1" fill="currentColor" />
    <rect x="7" y="6" width="2.2" height="11" rx="1" fill="currentColor" />
    <rect x="11" y="3" width="2.2" height="14" rx="1" fill="currentColor" />
    <rect x="15" y="8" width="2.2" height="9" rx="1" fill="currentColor" />
  </svg>
);

// A plain server component -- the year toggle + per-bar hover tooltip live
// in the leaf WeekdayFingerprintChart client component instead (see
// GenreDietWidget for why that split matters for this widget's static
// .size property).
export function WeekdayFingerprintWidget({
  fingerprintByYear,
  years,
  defaultYear,
}: {
  fingerprintByYear: Record<number, WeekdayFingerprint | null>;
  years: number[];
  defaultYear: number;
}) {
  const anyData = years.some((y) => fingerprintByYear[y]);
  if (!anyData) return null;

  return (
    <WidgetCard title="Weekday fingerprint" accent="blue" icon={ICON}>
      <WeekdayFingerprintChart fingerprintByYear={fingerprintByYear} years={years} defaultYear={defaultYear} />
    </WidgetCard>
  );
}

WeekdayFingerprintWidget.size = "feature" as const;
