-- Distinguishes "explicitly confirmed no gateway" from "never asked" -- both
-- look identical (all three gateway_* fields null) without this, which
-- would break backfill triage's resumability/progress ("83 of 224 traced").
-- Set only when the client signals an actual interaction with the picker
-- (gateway_touched=true on write), never inferred from the gateway_* values
-- themselves, and never overwritten once set (see the PATCH routes' use of
-- coalesce(gateway_checked_at, now())).

alter table books add column gateway_checked_at timestamptz;
alter table tbr add column gateway_checked_at timestamptz;
