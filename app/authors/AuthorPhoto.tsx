import { fraunces } from "../shared/fonts";
import { coverGradient } from "../shared/coverPalette";

// Read-only photo/initials placeholder for author cards (the index grid).
// The detail page's editable header photo reuses the existing <Cover>
// component directly instead -- it's already generic over id/title/url.
export function AuthorPhoto({
  name,
  photoUrl,
  className = "aspect-square w-full",
  initialClassName = "text-2xl",
}: {
  name: string;
  photoUrl: string | null;
  className?: string;
  initialClassName?: string;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${
        photoUrl
          ? "bg-paper"
          : `flex items-center justify-center bg-gradient-to-br shadow-sm ring-1 ring-black/10 dark:ring-white/10 ${coverGradient(name)}`
      } ${className}`}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span className={`${fraunces.className} font-semibold text-black/25 dark:text-white/25 ${initialClassName}`}>
          {name.charAt(0)}
        </span>
      )}
    </div>
  );
}
