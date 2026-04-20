-- Lien public « tableau équipe » (sans compte) : UUID secret dans l’URL.

ALTER TABLE public.reputexa_challenge_campaigns
  ADD COLUMN IF NOT EXISTS team_share_token UUID;

UPDATE public.reputexa_challenge_campaigns
SET team_share_token = gen_random_uuid()
WHERE team_share_token IS NULL;

ALTER TABLE public.reputexa_challenge_campaigns
  ALTER COLUMN team_share_token SET DEFAULT gen_random_uuid(),
  ALTER COLUMN team_share_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_reputexa_challenge_campaigns_team_share_token
  ON public.reputexa_challenge_campaigns (team_share_token);

COMMENT ON COLUMN public.reputexa_challenge_campaigns.team_share_token IS 'Token secret pour la page publique classement équipe (partage WhatsApp).';
