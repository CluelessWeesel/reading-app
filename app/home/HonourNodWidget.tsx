import Link from "next/link";
import { WidgetShell } from "./WidgetShell";
import type { BookOfTheYear } from "./types";

export function HonourNodWidget({ honour }: { honour: BookOfTheYear }) {
  if (!honour) return null;

  const label = `Your ${honour.year} Book of the Year: ${honour.title}${
    honour.author ? ` by ${honour.author}` : ""
  } 🏆`;

  return (
    <WidgetShell title="Honours">
      <p className="text-sm text-ink">
        {honour.book_id != null ? (
          <Link href={`/books/${honour.book_id}`} className="hover:underline">
            {label}
          </Link>
        ) : (
          label
        )}
      </p>
    </WidgetShell>
  );
}
