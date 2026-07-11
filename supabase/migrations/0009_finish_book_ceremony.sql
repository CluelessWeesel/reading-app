-- Schema for the "finish a book" ceremony.
create table if not exists prompts (
  id bigint generated always as identity primary key,
  question text not null,
  active boolean not null default true
);

create table if not exists prompt_answers (
  id bigint generated always as identity primary key,
  book_id integer not null references books (book_id) on delete cascade,
  prompt_id bigint not null references prompts (id) on delete cascade,
  answer text not null,
  answered_at timestamptz not null default now(),
  unique (book_id, prompt_id)
);

create table if not exists book_ratings (
  id bigint generated always as identity primary key,
  book_id integer not null references books (book_id) on delete cascade,
  category text not null references rating_categories (category),
  score numeric(3, 1) not null check (score >= 0.5 and score <= 5),
  unique (book_id, category)
);

alter table books add column if not exists review text;

-- PLACEHOLDER prompts -- replace with the real 48 once provided (a plain
-- INSERT/DELETE, no schema change needed).
insert into prompts (question) values
  ('[PLACEHOLDER] What surprised you most about this book?'),
  ('[PLACEHOLDER] Which character will you remember longest?'),
  ('[PLACEHOLDER] What''s one line or scene you want to remember?'),
  ('[PLACEHOLDER] Would you recommend this to a specific person? Who?'),
  ('[PLACEHOLDER] What did this book change about how you think?'),
  ('[PLACEHOLDER] What was the weakest part of this book?'),
  ('[PLACEHOLDER] How does this compare to others in the same genre?'),
  ('[PLACEHOLDER] What mood or feeling defines this book for you?');
