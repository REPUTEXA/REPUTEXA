-- Règle automation : message WhatsApp « client VIP du mois » (envoi le 1er, mois civil précédent, fuseau Paris géré côté appli).

ALTER TABLE public.banano_loyalty_automation_rules
  DROP CONSTRAINT IF EXISTS banano_loyalty_automation_rules_rule_type_check;

ALTER TABLE public.banano_loyalty_automation_rules
  ADD CONSTRAINT banano_loyalty_automation_rules_rule_type_check
  CHECK (rule_type IN ('lost_client', 'birthday', 'vip_of_month'));
