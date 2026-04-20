-- Affichage auteur (snapshot à la création) + code pays pour drapeau
ALTER TABLE public.app_suggestions
  ADD COLUMN IF NOT EXISTS author_full_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS author_country_code text;

COMMENT ON COLUMN public.app_suggestions.author_full_name IS
  'Nom ou établissement affiché sur la carte (copie à la création).';
COMMENT ON COLUMN public.app_suggestions.author_country_code IS
  'Code pays ISO 3166-1 alpha-2 pour emoji drapeau (ex. FR).';

UPDATE public.app_suggestions s
SET
  author_full_name = COALESCE(
    NULLIF(TRIM(p.full_name), ''),
    NULLIF(TRIM(p.establishment_name), ''),
    ''
  )
FROM public.profiles p
WHERE p.id = s.user_id
  AND TRIM(COALESCE(s.author_full_name, '')) = '';
