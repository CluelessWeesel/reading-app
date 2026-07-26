import { pool } from "@/lib/db";
import { TbrView } from "./TbrView";
import type { ResolvedPrediction } from "./tbrPredictionMath";
import type { TbrEntry } from "./types";

export const dynamic = "force-dynamic";

async function getEntries(): Promise<TbrEntry[]> {
  const { rows } = await pool.query<TbrEntry>(
    `select id, title, author, owned_or_format, subgenre, genre, word_count, page_count, cover_url, owned,
            predicted_score::float8 as predicted_score, predicted_margin::float8 as predicted_margin,
            to_char(created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
            to_char(owned_added_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as owned_added_at,
            to_char(unowned_added_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as unowned_added_at,
            to_char(predicted_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as predicted_at
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

// Subgenre is free text (no dedicated table like genre has), so its
// suggestion list is every distinct value already in use across both the
// TBR and the finished/reading library, not just what's on the TBR itself.
async function getSubgenres(): Promise<string[]> {
  const { rows } = await pool.query<{ subgenre: string }>(
    `select distinct subgenre from (
       select subgenre from books where subgenre is not null
       union
       select subgenre from tbr where subgenre is not null
     ) s order by subgenre asc`
  );
  return rows.map((r) => r.subgenre);
}

// Every book that had a prediction (carried onto it from its TBR entry --
// see app/api/start-book/route.ts) and has since been given a real score --
// the population the accuracy stats on the TBR panel are computed over.
async function getResolvedPredictions(): Promise<ResolvedPrediction[]> {
  const { rows } = await pool.query<ResolvedPrediction>(
    `select book_id, predicted_score::float8 as predicted_score, predicted_margin::float8 as predicted_margin,
            score::float8 as score
     from books
     where predicted_score is not null and predicted_margin is not null and score is not null`
  );
  return rows;
}

export default async function TbrPage() {
  const [entries, allGenres, allSubgenres, resolvedPredictions] = await Promise.all([
    getEntries(),
    getGenres(),
    getSubgenres(),
    getResolvedPredictions(),
  ]);
  return (
    <TbrView
      entries={entries}
      allGenres={allGenres}
      allSubgenres={allSubgenres}
      resolvedPredictions={resolvedPredictions}
    />
  );
}
