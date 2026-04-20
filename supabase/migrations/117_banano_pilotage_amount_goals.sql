-- Pilotage : montant ticket optionnel sur les événements + objectifs journaliers (profil)

ALTER TABLE public.banano_loyalty_events
  ADD COLUMN IF NOT EXISTS amount_cents INT
  CHECK (
    amount_cents IS NULL
    OR (amount_cents >= 0 AND amount_cents <= 100000000)
  );

COMMENT ON COLUMN public.banano_loyalty_events.amount_cents IS
  'Montant TTC du ticket en centimes (optionnel), saisi à la caisse Banano pour CA / panier moyen.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banano_pilotage_daily_revenue_goal_cents INT
  CHECK (
    banano_pilotage_daily_revenue_goal_cents IS NULL
    OR (
      banano_pilotage_daily_revenue_goal_cents >= 0
      AND banano_pilotage_daily_revenue_goal_cents <= 1000000000
    )
  ),
  ADD COLUMN IF NOT EXISTS banano_pilotage_daily_visit_goal INT
  CHECK (
    banano_pilotage_daily_visit_goal IS NULL
    OR (
      banano_pilotage_daily_visit_goal >= 1
      AND banano_pilotage_daily_visit_goal <= 100000
    )
  );

COMMENT ON COLUMN public.profiles.banano_pilotage_daily_revenue_goal_cents IS
  'Objectif CA journalier (centimes) pour la jauge du pilotage ; NULL = non défini.';
COMMENT ON COLUMN public.profiles.banano_pilotage_daily_visit_goal IS
  'Objectif passages fidélité / jour si pas de CA saisi ; NULL = non défini.';
