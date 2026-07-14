-- Formatted plain-text migration target for rambler_reviews (the old
-- per-category "Rambler" review system for a handful of books) -- kept
-- separate from the regular review column since it's a distinct legacy
-- format, not a real review the user wrote for this app.
alter table books add column if not exists legacy_notes text;
