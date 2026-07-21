-- The Home page's "twin altars" panels use a deep-toned background sampled
-- from each in-progress book's cover -- extracted client-side (no cover
-- image-processing dependency exists in this project, and covers come from
-- arbitrary external hosts anyway), then cached here so it's computed once
-- per book rather than re-extracted by every visitor/render.
alter table current_books add column if not exists dominant_color text;
