-- Ceremony session state for /weesels/ceremony/[year]. Ceremony *results*
-- reuse the existing weesels/weesel_categories/weesel_years tables directly
-- (a confirmed category's nominees are just weesels rows with
-- result='nominee'; a reveal flips one to 'winner'; a seal is the existing
-- weesel_years insert) -- these two tables only hold things that aren't
-- permanent award data.

-- Marks a category as reviewed in pre-flight for a given year, independent
-- of whether it ended up running -- lets a confirmed "does not run" (zero
-- final candidates) be distinguished from "not yet reviewed", without
-- writing a placeholder row into weesels.
create table if not exists weesel_ceremony_progress (
  year integer not null,
  category_id bigint not null references weesel_categories(id),
  confirmed_at timestamptz not null default now(),
  primary key (year, category_id)
);

-- A visible, reason-required audit log for post-seal corrections.
create table if not exists weesel_amendments (
  id bigint generated always as identity primary key,
  year integer not null references weesel_years(year),
  category_id bigint references weesel_categories(id),
  reason text not null,
  amended_at timestamptz not null default now()
);
