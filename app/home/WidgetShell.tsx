import Link from "next/link";
import type { ReactNode } from "react";
import { fraunces } from "../shared/fonts";

// Shared chrome for a home-page widget -- new widgets just wrap their
// content in this for a consistent title/card/link treatment, so the page
// itself stays a plain ordered list of widgets that's easy to add to or
// reorder (see page.tsx).
export function WidgetShell({
  title,
  href,
  hrefLabel = "View more",
  children,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-hairline bg-card/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className={`${fraunces.className} text-lg font-semibold text-ink`}>{title}</h2>
        {href && (
          <Link
            href={href}
            className="shrink-0 text-xs text-ink-faint underline decoration-dotted underline-offset-4 hover:text-ink"
          >
            {hrefLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
