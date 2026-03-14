-- Ajout des champs de Bouclier IA sur la table reviews
-- - is_toxic : indicateur d'avis toxique (haine, doxxing, spam, conflit d'intérêt)
-- - toxicity_reason : texte court décrivant le motif principal détecté
-- - toxicity_created_at : date/heure de première détection
-- - toxicity_resolved_at : date/heure de résolution (procédure de suppression lancée)

alter table public.reviews
  add column if not exists is_toxic boolean not null default false;

alter table public.reviews
  add column if not exists toxicity_reason text;

alter table public.reviews
  add column if not exists toxicity_created_at timestamptz;

alter table public.reviews
  add column if not exists toxicity_resolved_at timestamptz;

