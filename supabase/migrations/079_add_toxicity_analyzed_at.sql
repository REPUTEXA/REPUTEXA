-- Shield Center: track whether a review has been through the toxicity analysis pipeline.
-- NULL means "not yet analyzed" (e.g. reviews ingested via webhook before this migration).
-- Non-null means the analysis ran (review may still be is_toxic = false if clean).

alter table public.reviews
  add column if not exists toxicity_analyzed_at timestamptz default null;

-- Back-fill: reviews already marked toxic were definitely analyzed
update public.reviews
set toxicity_analyzed_at = toxicity_created_at
where is_toxic = true
  and toxicity_created_at is not null
  and toxicity_analyzed_at is null;

-- Back-fill: reviews created via the manual route (have complaint text) were analyzed
update public.reviews
set toxicity_analyzed_at = created_at
where toxicity_analyzed_at is null
  and (toxicity_complaint_text is not null or toxicity_legal_argumentation is not null);

-- Index for the cron sweep query
create index if not exists idx_reviews_toxicity_analyzed_at
  on public.reviews (toxicity_analyzed_at)
  where toxicity_analyzed_at is null;
