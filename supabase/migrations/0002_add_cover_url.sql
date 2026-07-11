-- Adds a place to cache the resolved cover image URL per book, so we don't
-- re-hit Google Books / Open Library on every page load. NULL means "no
-- cover found yet, or none available" -- the /library page falls back to
-- the placeholder in that case.
alter table books add column if not exists cover_url text;
