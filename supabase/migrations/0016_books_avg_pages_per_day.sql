-- The tracked per-book reading pace from the spreadsheet's "Read Books"
-- sheet ("Avg Pages/Day" column) -- the ground-truth figure date_started
-- was itself derived FROM (see scripts/backfill-date-started.ts), so
-- reconstructing pace by dividing page_count back out of date_started..
-- date_finished just reintroduces the rounding that math already went
-- through. Stored directly here instead.
alter table books add column if not exists avg_pages_per_day numeric;
