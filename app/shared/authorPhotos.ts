import { pool } from "@/lib/db";

// A small, single lookup (the authors table is a few hundred rows at most)
// reused by every page that shows an author's name somewhere without
// already joining authors itself -- avoids adding a photo_url column to
// half a dozen unrelated queries just to resolve a circular thumbnail.
export async function getAuthorPhotoMap(): Promise<Record<number, string | null>> {
  const { rows } = await pool.query<{ id: number; photo_url: string | null }>(
    `select id::int as id, photo_url from authors`
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.photo_url]));
}
