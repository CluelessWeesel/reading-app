import { pool } from "@/lib/db";

// Mirrors authorPhotos.ts's getAuthorPhotoMap -- a small, single lookup
// reused by every page that shows a narrator's name somewhere without
// already joining narrators itself.
export async function getNarratorPhotoMap(): Promise<Record<number, string | null>> {
  const { rows } = await pool.query<{ id: number; photo_url: string | null }>(
    `select id::int as id, photo_url from narrators`
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.photo_url]));
}
