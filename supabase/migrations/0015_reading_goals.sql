-- Simple per-year pages goal, referenced by the /stats pace chart's goal
-- line and projection. Editable inline from the stats page itself (no
-- separate admin UI) -- this table is just the storage for that.
create table if not exists reading_goals (
  year integer primary key,
  pages_goal integer not null
);

insert into reading_goals (year, pages_goal) values (2026, 28900)
  on conflict (year) do nothing;
