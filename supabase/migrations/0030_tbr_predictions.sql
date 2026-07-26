-- Predictions move to TBR: entered whenever, long before the book is
-- started, then carried silently onto the books row when it is (see
-- app/api/start-book/route.ts). predicted_at lets the finish ceremony say
-- "you called this N days ago" -- books gets the same column so the value
-- travels with the book rather than being re-stamped at start time.
alter table tbr add column if not exists predicted_score numeric(3, 1);
alter table tbr add constraint tbr_predicted_score_range
  check (predicted_score is null or (predicted_score >= 0.5 and predicted_score <= 5));

alter table tbr add column if not exists predicted_margin numeric(3, 1);
alter table tbr add constraint tbr_predicted_margin_range
  check (predicted_margin is null or (predicted_margin >= 0 and predicted_margin <= 4.5));

alter table tbr add column if not exists predicted_at timestamptz;

alter table books add column if not exists predicted_at timestamptz;
