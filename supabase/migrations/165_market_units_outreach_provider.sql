-- Unités marché : locale publique, fournisseur d’envoi (Instantly / Smartlead), index cluster domaines + email prospects.

ALTER TABLE public.growth_country_configs
  ADD COLUMN IF NOT EXISTS "publicSiteLocaleEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "outreachProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "instantlyCampaignId" TEXT,
  ADD COLUMN IF NOT EXISTS "smartleadCampaignId" TEXT;

CREATE INDEX IF NOT EXISTS outreach_domains_country_code_idx ON public.outreach_domains ("countryCode");

CREATE INDEX IF NOT EXISTS "Prospect_email_idx" ON public."Prospect" ("email");
