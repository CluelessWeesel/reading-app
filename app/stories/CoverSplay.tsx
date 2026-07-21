import { CoverThumb } from "../shared/CoverThumb";

// The fanned, overlapping row of covers used by every "opener" card (the
// original generic Hero, now also the recap header and Wrapped's cold
// open) -- a light rotation per cover around the row's center, layered by
// z-index so later covers sit on top, same idea as a hand of cards splayed
// on a table.
export function CoverSplay({ coverUrls, size = "w-16 sm:w-20" }: { coverUrls: string[]; size?: string }) {
  if (coverUrls.length === 0) return null;

  return (
    <div className="flex -space-x-6">
      {coverUrls.slice(0, 5).map((url, i) => (
        <div
          key={`${url}-${i}`}
          className="shadow-lg ring-2 ring-black/10 dark:ring-white/10"
          style={{ transform: `rotate(${(i - (coverUrls.length - 1) / 2) * 6}deg)`, zIndex: i }}
        >
          <CoverThumb title="" coverUrl={url} className={`aspect-[2/3] ${size}`} />
        </div>
      ))}
    </div>
  );
}
