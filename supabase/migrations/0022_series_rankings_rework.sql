-- series_rankings has existed since the initial schema but was never
-- surfaced anywhere in the app. It's getting drag-to-reorder ledgers on
-- /rankings, matching book_rankings' shape: every row always has a rank
-- (integer, consecutive per list), reordering shifts multiple rows in one
-- transaction, and changes are logged.

-- Two rows currently have no rank at all -- give them one so every row
-- starts out ranked, appended after the current max for their list.
with unranked as (
  select id, list_name, series,
    row_number() over (partition by list_name order by series) as rn
  from series_rankings
  where rank is null
),
maxes as (
  select list_name, max(rank) as max_rank
  from series_rankings
  where rank is not null
  group by list_name
)
update series_rankings sr
set rank = m.max_rank + u.rn
from unranked u
join maxes m on m.list_name = u.list_name
where sr.id = u.id;

-- Was `numeric` (to allow nulls/fractional insertion ranks); every row is
-- always ranked now, so this matches book_rankings' `rank integer not null`.
alter table series_rankings alter column rank type integer using rank::integer;
alter table series_rankings alter column rank set not null;

-- Same deferred-constraint trick as book_rankings (migration 0010): reordering
-- shifts several rows' ranks in one multi-row UPDATE, which would hit a
-- transient collision against a normal (immediate) unique constraint.
alter table series_rankings
  add constraint series_rankings_list_name_rank_key unique (list_name, rank) deferrable initially deferred;

-- Sibling to rank_changes (which is keyed by book_id/year -- doesn't fit a
-- series' natural key of list_name/series). Mirrors its shape; old_rank is
-- never null here since every series_rankings row is always ranked.
create table if not exists series_rank_changes (
  id bigint generated always as identity primary key,
  list_name text not null,
  series text not null,
  old_rank integer not null,
  new_rank integer not null,
  changed_at timestamptz not null default now()
);
