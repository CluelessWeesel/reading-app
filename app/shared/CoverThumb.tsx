import { fraunces } from "./fonts";
import { coverGradient } from "./coverPalette";

// Read-only cover thumbnail -- for contexts like drill-down lists or the
// author bookshelf where nothing should be editable, unlike the full
// interactive <Cover>.
export function CoverThumb({
  title,
  coverUrl,
  className = "aspect-[2/3] w-8",
}: {
  title: string;
  coverUrl: string | null;
  className?: string;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded ${
        coverUrl
          ? "bg-paper"
          : `flex items-center justify-center bg-gradient-to-br shadow-sm ring-1 ring-black/10 dark:ring-white/10 ${coverGradient(title)}`
      } ${className}`}
    >
      {coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt={`Cover of ${title}`} loading="lazy" className="h-full w-full object-contain" />
      ) : (
        <span className={`${fraunces.className} text-xs font-semibold text-black/25 dark:text-white/25`}>
          {title.charAt(0)}
        </span>
      )}
    </div>
  );
}
