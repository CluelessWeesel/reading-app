-- Reading app schema, mirroring the 12 sheets in reading_data_gold.xlsx.
-- Run this once in the Supabase SQL editor to create all tables.
--
-- FK notes (see conversation / commit message for full reasoning):
--   - books.genre and tbr.genre reference genres(genre) -- fully covered by the data.
--   - rating_templates.category references rating_categories(category) -- fully covered.
--   - book_rankings.book_id references books(book_id) -- nullable: kept as a safety net,
--     since normalized title matching in the import script resolves all current rows.
--   - series, series_rankings.series, tbr.subgenre, rambler_reviews.category, and
--     genres.template are intentionally NOT foreign keys -- the source data doesn't
--     cleanly support it (see explanation given alongside this migration).

create table if not exists rating_categories (
  category text primary key,
  scope text not null
);

create table if not exists rating_templates (
  template text not null,
  category text not null references rating_categories (category),
  primary key (template, category)
);

create table if not exists genres (
  genre text primary key,
  template text not null
);

create table if not exists series (
  series text primary key,
  parent_series text
);

create table if not exists books (
  book_id integer primary key,
  title text not null,
  author text not null,
  series text,
  series_number numeric,
  genre text not null references genres (genre),
  year_released integer,
  year_read integer not null,
  score numeric(3, 1),
  format_raw text not null,
  word_count numeric,
  page_count integer not null,
  format_type text not null,
  narrator text,
  reread boolean not null default false,
  date_started date,
  date_finished date,
  isbn text,
  status text
);
create index if not exists books_genre_idx on books (genre);

create table if not exists book_rankings (
  id bigint generated always as identity primary key,
  list_id text not null,
  rank integer not null,
  title text not null,
  book_id integer references books (book_id),
  score numeric(3, 1) not null,
  had_star boolean not null default false,
  year integer not null,
  unique (list_id, rank)
);
create index if not exists book_rankings_book_id_idx on book_rankings (book_id);

create table if not exists series_rankings (
  id bigint generated always as identity primary key,
  list_name text not null,
  rank numeric,
  series text not null,
  status_flag text not null,
  unique (list_name, series)
);

create table if not exists daily_reading (
  date date primary key,
  pages integer not null
);

create table if not exists weesels (
  id bigint generated always as identity primary key,
  year integer not null,
  category text not null,
  nominee text not null,
  author_or_narrator text,
  result text not null,
  unique (year, category, nominee)
);

create table if not exists tbr (
  id bigint generated always as identity primary key,
  title text not null unique,
  owned_or_format text,
  word_count integer not null,
  subgenre text not null,
  genre text not null references genres (genre)
);
create index if not exists tbr_genre_idx on tbr (genre);

create table if not exists rambler_reviews (
  id bigint generated always as identity primary key,
  review_subject text not null,
  category text not null,
  score numeric(3, 1) not null,
  commentary text not null,
  unique (review_subject, category)
);

create table if not exists current_books (
  id bigint generated always as identity primary key,
  title text not null,
  format_type text not null,
  position text not null,
  started date not null
);

-- Supabase exposes tables over its API by default; enable RLS on all of them so
-- nothing is readable/writable until you explicitly add policies for your app.
alter table rating_categories enable row level security;
alter table rating_templates enable row level security;
alter table genres enable row level security;
alter table series enable row level security;
alter table books enable row level security;
alter table book_rankings enable row level security;
alter table series_rankings enable row level security;
alter table daily_reading enable row level security;
alter table weesels enable row level security;
alter table tbr enable row level security;
alter table rambler_reviews enable row level security;
alter table current_books enable row level security;
