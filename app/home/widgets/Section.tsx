import type { ReactNode } from "react";
import { widgetSpanClass } from "./WidgetCard";
import type { WidgetSize } from "./WidgetCard";

export type SectionItem =
  | { key: string; size: WidgetSize; node: ReactNode }
  | { key: string; divider: true }
  | null
  | false;

type ShownItem = Exclude<SectionItem, null | false>;

// A titled row of widgets: small-caps letter-spaced label, a thin gold
// rule trailing off to the right, then a 12-col grid where each item's own
// declared size decides its span. Items that are null/false (a widget
// whose data came back empty) are dropped before layout -- no empty grid
// cells, per "skips rendering gracefully" on every widget. A `divider`
// item renders a thin full-width gold rule at that point in the grid, for
// visually separating groups of widgets within one section (e.g. a
// feature pair from the compact row beneath it) without needing a whole
// separate Section for it.
export function Section({ label, items }: { label: string; items: SectionItem[] }) {
  const shown = items.filter((item): item is ShownItem => Boolean(item));
  if (shown.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="section-label shrink-0 text-xs font-semibold text-ink-warm-faint">{label}</h2>
        <div className="h-px flex-1 bg-gold-ink/25" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {shown.map((item) =>
          "divider" in item ? (
            <div key={item.key} className="md:col-span-12">
              <div className="h-px w-full bg-gold-ink/20" />
            </div>
          ) : (
            <div key={item.key} className={widgetSpanClass(item.size)}>
              {item.node}
            </div>
          )
        )}
      </div>
    </section>
  );
}
