 -- Supports the /books/[id] dossier page: a finer-grained genre label, and a
-- manually-entered prediction (shown alongside the computed model estimate,
-- which is derived on the fly and needs no storage).
alter table books add column if not exists subgenre text;

alter table books add column if not exists predicted_score numeric(3, 1);
alter table books add constraint books_predicted_score_range
  check (predicted_score is null or (predicted_score >= 0.5 and predicted_score <= 5));

alter table books add column if not exists predicted_margin numeric(3, 1);
alter table books add constraint books_predicted_margin_range
  check (predicted_margin is null or (predicted_margin >= 0 and predicted_margin <= 4.5));
