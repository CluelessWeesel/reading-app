-- Frozen story documents (monthly recaps, yearly Wrapped, future rituals).
-- payload is the fully-computed card deck at generation time -- rendering
-- always reads this JSON, never live data, so a past recap can't silently
-- drift if later edits change the underlying books/scores. Re-running the
-- computation (an explicit, confirmed "regenerate") overwrites payload and
-- generated_at in place; it does not touch user_note, which is a separate,
-- freeform annotation the user wrote and isn't part of the computed stats.
create table if not exists generated_stories (
  id bigint generated always as identity primary key,
  story_type text not null check (story_type in ('recap', 'wrapped')),
  period text not null, -- e.g. '2026-07' for a recap, '2026' for wrapped
  payload jsonb not null,
  generated_at timestamptz not null default now(),
  user_note text,
  unique (story_type, period)
);
create index if not exists generated_stories_type_period_idx on generated_stories (story_type, period);

alter table generated_stories enable row level security;
