-- Score de confiance de la réponse IA (Forge / auto-validation)

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS ai_confidence_score SMALLINT
    CHECK (ai_confidence_score IS NULL OR (ai_confidence_score >= 0 AND ai_confidence_score <= 100));

COMMENT ON COLUMN public.reviews.ai_confidence_score IS
  'Confiance 0–100 sur la réponse générée (contrôle Forge). Sous le seuil : revue commerçant.';
