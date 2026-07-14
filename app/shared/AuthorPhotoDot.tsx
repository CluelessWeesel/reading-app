import { AuthorPhoto } from "../authors/AuthorPhoto";

// A small circular author photo (or initial) to sit beside a name wherever
// it's linked to /authors/[id] -- same visual as the author index/detail
// pages, just shrunk down for inline use next to book/leaderboard rows.
export function AuthorPhotoDot({
  name,
  authorId,
  photos,
  className = "aspect-square w-5",
}: {
  name: string;
  authorId: number | null | undefined;
  photos: Record<number, string | null>;
  className?: string;
}) {
  if (authorId == null) return null;
  return (
    <AuthorPhoto name={name} photoUrl={photos[authorId] ?? null} className={className} initialClassName="text-[8px]" />
  );
}
