-- TTL recommandé : 30 jours — nettoyage assuré par le cron Vercel
-- `/api/cron/banano-loyalty-idempotency-prune` (voir vercel.json).

CREATE INDEX IF NOT EXISTS idx_banano_loyalty_transact_idem_created_at
  ON public.banano_loyalty_transact_idempotency (created_at);

COMMENT ON TABLE public.banano_loyalty_transact_idempotency IS
  'Réponses API mémorisées par clé client pour éviter double application au rejeu (mode dégradé terminal). '
  'Les lignes plus anciennes que 30 jours sont supprimées par tâche planifiée ; les rejeux récents restent couverts.';
