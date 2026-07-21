import { pool } from "@/lib/db";
import { getNarratorPhotoMap } from "../../shared/narratorPhotos";
import { getCategories, getWeeselRows } from "../data";
import { AuthorWinsBoard } from "./AuthorWinsBoard";

export const dynamic = "force-dynamic";

async function getAuthorPhotos(): Promise<Record<number, string | null>> {
  const { rows } = await pool.query<{ id: number; photo_url: string | null }>(
    `select id::int as id, photo_url from authors`
  );
  const map: Record<number, string | null> = {};
  for (const r of rows) map[r.id] = r.photo_url;
  return map;
}

export default async function WeeselsLeaderboardPage() {
  const [rows, categories, photos, narratorPhotos] = await Promise.all([
    getWeeselRows(),
    getCategories(),
    getAuthorPhotos(),
    getNarratorPhotoMap(),
  ]);
  return <AuthorWinsBoard rows={rows} categories={categories} photos={photos} narratorPhotos={narratorPhotos} />;
}
