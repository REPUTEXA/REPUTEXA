-- Base Clients : nom/prénom séparés, dernière visite, compteur de visites (fidélité)

ALTER TABLE public.banano_loyalty_members
  ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifetime_visit_count INT NOT NULL DEFAULT 0
    CHECK (lifetime_visit_count >= 0);

COMMENT ON COLUMN public.banano_loyalty_members.lifetime_visit_count IS
  'Nombre d’enregistrements visite (earn_points / earn_stamps) — proxy "gros clients".';

-- Rétro-remplissage prénom/nom depuis display_name
UPDATE public.banano_loyalty_members
SET
  first_name = split_part(trim(display_name), ' ', 1),
  last_name = CASE
    WHEN strpos(trim(display_name), ' ') > 0 THEN
      trim(substring(trim(display_name) from strpos(trim(display_name), ' ') + 1))
    ELSE ''
  END
WHERE trim(display_name) <> '';

-- Stats depuis l’historique fidélité
WITH agg AS (
  SELECT
    member_id,
    COUNT(*) FILTER (WHERE event_type IN ('earn_points', 'earn_stamps')) AS vc,
    MAX(created_at) FILTER (WHERE event_type IN ('earn_points', 'earn_stamps')) AS lv
  FROM public.banano_loyalty_events
  GROUP BY member_id
)
UPDATE public.banano_loyalty_members m
SET
  lifetime_visit_count = COALESCE(agg.vc, 0),
  last_visit_at = agg.lv
FROM agg
WHERE m.id = agg.member_id;

CREATE OR REPLACE FUNCTION public.banano_loyalty_events_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type IN ('earn_points', 'earn_stamps') THEN
    UPDATE public.banano_loyalty_members
    SET
      last_visit_at = NEW.created_at,
      lifetime_visit_count = lifetime_visit_count + 1,
      updated_at = now()
    WHERE id = NEW.member_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS banano_loyalty_events_after_insert ON public.banano_loyalty_events;
CREATE TRIGGER banano_loyalty_events_after_insert
  AFTER INSERT ON public.banano_loyalty_events
  FOR EACH ROW EXECUTE FUNCTION public.banano_loyalty_events_after_insert();
