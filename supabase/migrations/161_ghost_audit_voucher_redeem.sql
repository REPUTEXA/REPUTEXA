-- Audit Agent Ghost : encaissement bon fidélité

ALTER TABLE public.banano_ghost_audit_events
  DROP CONSTRAINT IF EXISTS banano_ghost_audit_events_action_check;

ALTER TABLE public.banano_ghost_audit_events
  ADD CONSTRAINT banano_ghost_audit_events_action_check
  CHECK (action IN (
    'scan_resolve',
    'transact_earn',
    'transact_redeem_points',
    'ticket_sniffer',
    'macro_play',
    'enroll',
    'device_bind',
    'voucher_redeem'
  ));
