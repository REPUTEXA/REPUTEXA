-- Comptage des signaux « même auteur » dans la mémoire Omni (canal google) pour la fidélité 6 mois,
-- scoping par établissement (principal = establishment_id NULL).

CREATE OR REPLACE FUNCTION public.omni_prior_reviewer_count(
  filter_user_id uuid,
  filter_establishment_id uuid,
  reviewer_normalized text,
  since_ts timestamptz
) RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.omni_interaction_memories m
  WHERE m.user_id = filter_user_id
    AND m.channel = 'google'
    AND m.created_at >= since_ts
    AND reviewer_normalized IS NOT NULL
    AND trim(lower(coalesce(m.metadata->>'reviewer_name_normalized', m.metadata->>'reviewer_name', ''))) = reviewer_normalized
    AND (
      (filter_establishment_id IS NULL AND m.establishment_id IS NULL)
      OR m.establishment_id = filter_establishment_id
    );
$$;

COMMENT ON FUNCTION public.omni_prior_reviewer_count(uuid, uuid, text, timestamptz) IS
  'Omni-Synapse : nombre de mémoires google antérieures pour le même nom (normalisé), même périmètre établissement.';

REVOKE ALL ON FUNCTION public.omni_prior_reviewer_count(uuid, uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.omni_prior_reviewer_count(uuid, uuid, text, timestamptz) TO service_role;
