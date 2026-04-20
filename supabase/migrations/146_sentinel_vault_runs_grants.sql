-- Idempotent : si la migration 137 a déjà été appliquée sans les GRANT, cet appliqué sécurise les droits pour le statut Vault (insert/update cron).

GRANT ALL ON TABLE public.sentinel_vault_runs TO postgres;
GRANT ALL ON TABLE public.sentinel_vault_runs TO service_role;
