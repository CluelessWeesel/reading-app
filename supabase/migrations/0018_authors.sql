-- One row per distinct author string on books, linked back via author_id.
-- books.author (the free-text field) is untouched -- everything that
-- already reads it keeps working; author_id is additive, for the new
-- /authors pages and cross-site linkification.
create table if not exists authors (
  id bigint generated always as identity primary key,
  name text not null unique,
  photo_url text
);

alter table books add column if not exists author_id bigint references authors (id);
create index if not exists books_author_id_idx on books (author_id);

-- tbr.author (free text) already exists (migration 0004); author_id is a
-- separate, nullable link for lazy backfilling -- most TBR authors aren't
-- confidently known yet, and that's fine.
alter table tbr add column if not exists author_id bigint references authors (id);
create index if not exists tbr_author_id_idx on tbr (author_id);
