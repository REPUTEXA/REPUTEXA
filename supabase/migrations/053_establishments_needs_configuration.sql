-- Slot "en attente" : créé par le webhook invoice.paid, à configurer par l'utilisateur
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS needs_configuration boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.establishments.needs_configuration IS 'True = slot créé après paiement expansion, en attente de nom/adresse par l''utilisateur';
