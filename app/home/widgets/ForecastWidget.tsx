import Link from "next/link";
import { WidgetCard } from "./WidgetCard";
import { formatDateShort } from "../../shared/formatDateShort";
import type { BookForecast } from "../forecastMath";

const ICON = (
  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden>
    <path d="M4 16 L4 10 L8 12 L12 6 L16 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="16" cy="8" r="1.4" fill="currentColor" />
  </svg>
);

export function ForecastWidget({ forecast }: { forecast: BookForecast[] | null }) {
  if (!forecast) return null;

  return (
    <WidgetCard title="The forecast" accent="blue" icon={ICON} compact>
      <ul className="space-y-1">
        {forecast.map((f) => (
          <li key={f.bookId} className="truncate text-xs text-ink-warm-faint">
            <Link href={`/books/${f.bookId}`} className="text-ink-warm hover:underline">
              {f.title}
            </Link>{" "}
            · est. {formatDateShort(f.estFinish as string)}
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

ForecastWidget.size = "compact" as const;
