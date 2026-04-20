-- Growth War Room : géoloc prospects/clients, configs pays, domaines d’envoi, journal outreach (Prisma / admin).

DO $$
BEGIN
  CREATE TYPE public."OutreachDomainStatus" AS ENUM ('WARMUP', 'ACTIVE', 'PAUSED', 'QUARANTINE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ProspectStatus' AND e.enumlabel = 'OPTED_OUT'
  ) THEN
    ALTER TYPE public."ProspectStatus" ADD VALUE 'OPTED_OUT';
  END IF;
END $$;

ALTER TABLE public."Establishment" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE public."Establishment" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;

ALTER TABLE public."Prospect" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE public."Prospect" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;
ALTER TABLE public."Prospect" ADD COLUMN IF NOT EXISTS "lastOutreachAt" TIMESTAMP(3);
ALTER TABLE public."Prospect" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);
ALTER TABLE public."Prospect" ADD COLUMN IF NOT EXISTS "clickedAt" TIMESTAMP(3);
ALTER TABLE public."Prospect" ADD COLUMN IF NOT EXISTS "optedOutAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Prospect_countryCode_status_idx" ON public."Prospect"("countryCode", "status");

CREATE TABLE IF NOT EXISTS public.growth_country_configs (
    "countryCode" TEXT NOT NULL,
    "outreachEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyOutreachCap" INTEGER NOT NULL DEFAULT 150,
    "localeDefault" TEXT NOT NULL DEFAULT 'fr',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT growth_country_configs_pkey PRIMARY KEY ("countryCode")
);

CREATE TABLE IF NOT EXISTS public.outreach_domains (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "countryCode" TEXT,
    "status" public."OutreachDomainStatus" NOT NULL DEFAULT 'WARMUP'::public."OutreachDomainStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT outreach_domains_pkey PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS outreach_domains_hostname_key ON public.outreach_domains ("hostname");

CREATE TABLE IF NOT EXISTS public.outreach_touches (
    "id" TEXT NOT NULL,
    "prospectId" TEXT,
    "establishmentId" TEXT,
    "channel" TEXT NOT NULL,
    "subjectOrRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT outreach_touches_pkey PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS outreach_touches_prospectId_createdAt_idx ON public.outreach_touches ("prospectId", "createdAt");
CREATE INDEX IF NOT EXISTS outreach_touches_establishmentId_createdAt_idx ON public.outreach_touches ("establishmentId", "createdAt");

ALTER TABLE public.outreach_touches DROP CONSTRAINT IF EXISTS outreach_touches_prospectId_fkey;
ALTER TABLE public.outreach_touches ADD CONSTRAINT outreach_touches_prospectId_fkey
  FOREIGN KEY ("prospectId") REFERENCES public."Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.outreach_touches DROP CONSTRAINT IF EXISTS outreach_touches_establishmentId_fkey;
ALTER TABLE public.outreach_touches ADD CONSTRAINT outreach_touches_establishmentId_fkey
  FOREIGN KEY ("establishmentId") REFERENCES public."Establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
