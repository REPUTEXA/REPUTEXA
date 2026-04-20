-- Ajoute le texte complet de la plainte juridique générée par l'IA

alter table public.reviews
  add column if not exists toxicity_complaint_text text;

