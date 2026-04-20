-- Texte détaillé d’argumentation juridique (conditions d’utilisation plateforme)

alter table public.reviews
  add column if not exists toxicity_legal_argumentation text;

