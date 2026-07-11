import { pool } from "@/lib/db";
import { TbrView } from "./TbrView";
import type { TbrEntry } from "./types";

export const dynamic = "force-dynamic";

async function getEntries(): Promise<TbrEntry[]> {
  const { rows } = await pool.query<TbrEntry>(
    `select id, title, author, owned_or_format, subgenre, genre, word_count, cover_url,
            to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
     from tbr
     order by title asc`
  );
  return rows;
}

async function getGenres(): Promise<string[]> {
  const { rows } = await pool.query<{ genre: string }>(
    `select genre from genres order by genre asc`
  );
  return rows.map((r) => r.genre);
}

export default async function TbrPage() {
  const [entries, allGenres] = await Promise.all([getEntries(), getGenres()]);
  return <TbrView entries={entries} allGenres={allGenres} />;
}
