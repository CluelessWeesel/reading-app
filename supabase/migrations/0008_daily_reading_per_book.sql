-- daily_reading was one row per date with a combined total pages figure
-- (spreadsheet-era historical data, 2023 through 2026-07-05/07). New entries
-- from the /log flow are per-book, so multiple rows can now share a date.
-- Existing 1284 rows are untouched other than gaining a NULL book_id -- any
-- stats view should SUM(pages) GROUP BY date to get a daily total across
-- both old and new rows.
alter table daily_reading add column book_id integer references books (book_id) on delete cascade;
alter table daily_reading add column id bigint generated always as identity;
alter table daily_reading drop constraint daily_reading_pkey;
alter table daily_reading add primary key (id);
alter table daily_reading add constraint daily_reading_date_book_key unique (date, book_id);
create index if not exists daily_reading_book_id_idx on daily_reading (book_id);
