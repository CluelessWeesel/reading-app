-- Adds an author field and a cover_url cache (same pattern as books.cover_url)
-- to tbr. Both nullable -- only title is required when adding a TBR entry.
alter table tbr add column if not exists author text;
alter table tbr add column if not exists cover_url text;
