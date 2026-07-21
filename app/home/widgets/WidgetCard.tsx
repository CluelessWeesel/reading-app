import type { ReactNode } from "react";
import Link from "next/link";

// wide = full row, feature = half-to-two-thirds (pairs up with another
// feature), compact = a third of a row, micro = a quarter of a row (four
// small cards side by side), chip = an inline one-line pill. A widget
// component declares its own size as a static .size property (see
// RhythmRibbon.size = "wide" etc.) -- the Section that composes them just
// reads it, rather than layout being decided ad-hoc per callsite.
export type WidgetSize = "wide" | "feature" | "compact" | "micro" | "chip";

export type WidgetAccent = "blue" | "purple" | "green" | "teal" | "pink" | "amber" | "coral" | "violet";

const SPAN: Record<WidgetSize, string> = {
  wide: "md:col-span-12",
  feature: "md:col-span-6",
  compact: "md:col-span-4",
  micro: "md:col-span-3",
  chip: "md:col-span-3",
};

export function widgetSpanClass(size: WidgetSize): string {
  return SPAN[size];
}

// Every accent color used on a card is a CSS custom property reference
// (var(--accent-x)), not a Tailwind utility class -- Tailwind's compiler
// only picks up literal class strings it can see in source, so a
// runtime-built class name like `bg-accent-${accent}` would silently
// produce no CSS at all.
function accentStyle(accent: WidgetAccent): { background: string; color: string } {
  return { background: `var(--accent-${accent}-chip)`, color: `var(--accent-${accent})` };
}

// The card shape: title row with a tinted icon-chip, then content. Used
// for wide/feature/compact. Chip-sized widgets render as a pill instead
// (see WidgetChip below) -- different shape, not just smaller.
export function WidgetCard({
  title,
  accent,
  icon,
  href,
  headerRight,
  compact = false,
  children,
}: {
  title: string;
  accent: WidgetAccent;
  icon: ReactNode;
  href?: string;
  // Small extra bit of content right-aligned in the title row, e.g. an
  // avg/best summary -- distinct from the "compact" size class below.
  headerRight?: ReactNode;
  // Tighter padding/icon size for micro-sized cards -- a visual density
  // knob, not a layout/grid-span decision (that's still owned by .size).
  compact?: boolean;
  children: ReactNode;
}) {
  const body = (
    <div className={`surface-card flex h-full flex-col rounded-xl ${compact ? "p-3" : "p-4"}`}>
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={`flex shrink-0 items-center justify-center rounded-full ${compact ? "h-6 w-6" : "h-7 w-7"}`}
          style={accentStyle(accent)}
        >
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-ink-warm">{title}</h3>
        {headerRight && <span className="ml-auto shrink-0">{headerRight}</span>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  );
}

// The pill shape for size="chip" -- one line, icon + label + a value slot.
export function WidgetChip({
  title,
  accent,
  icon,
  value,
}: {
  title: string;
  accent: WidgetAccent;
  icon: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="surface-card inline-flex w-full items-center gap-2.5 rounded-full px-4 py-2">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={accentStyle(accent)}
      >
        {icon}
      </span>
      <span className="truncate text-sm text-ink-warm-muted">{title}</span>
      <span className="ml-auto shrink-0 text-sm font-semibold text-ink-warm">{value}</span>
    </div>
  );
}
