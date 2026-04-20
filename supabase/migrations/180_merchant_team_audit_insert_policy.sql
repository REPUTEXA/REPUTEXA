-- Journal équipe : le marchand peut insérer ses propres entrées d’audit.
CREATE POLICY merchant_team_audit_insert ON public.merchant_team_audit_log
  FOR INSERT WITH CHECK (merchant_user_id = auth.uid());
