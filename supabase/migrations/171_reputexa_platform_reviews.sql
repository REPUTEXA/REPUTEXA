-- Avis produit REPUTEXA (dashboard → validation admin → landing)
CREATE TABLE IF NOT EXISTS public.reputexa_platform_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  locale text NOT NULL DEFAULT 'fr',
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body_original text NOT NULL,
  body_optimized text,
  body_public text NOT NULL,
  display_name text NOT NULL,
  role_line text,
  country_label text,
  flag_emoji text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS reputexa_platform_reviews_user_id_uidx
  ON public.reputexa_platform_reviews (user_id);

CREATE INDEX IF NOT EXISTS reputexa_platform_reviews_status_created_idx
  ON public.reputexa_platform_reviews (status, created_at DESC);

COMMENT ON TABLE public.reputexa_platform_reviews IS
  'Témoignages utilisateurs REPUTEXA (flux dashboard → modération → homepage).';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reputexa_platform_review_submitted_at timestamptz;

COMMENT ON COLUMN public.profiles.reputexa_platform_review_submitted_at IS
  'Rempli quand l’utilisateur a envoyé son témoignage depuis le dashboard ; masque le widget.';

ALTER TABLE public.reputexa_platform_reviews ENABLE ROW LEVEL SECURITY;

-- Accès uniquement via routes serveur (service role). Évite lecture/écriture directe anon.
CREATE POLICY reputexa_platform_reviews_block_all
  ON public.reputexa_platform_reviews
  FOR ALL
  USING (false)
  WITH CHECK (false);
