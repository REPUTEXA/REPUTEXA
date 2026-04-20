import type { SupabaseClient } from '@supabase/supabase-js';

export type SupportAuditInsert = {
  admin_id?: string | null;
  ticket_id?: string | null;
  action_type: string;
  metadata?: Record<string, unknown>;
  confidence_score?: number | null;
};

/**
 * Insertion best-effort dans support_audit_log (service_role).
 */
export async function logSupportAudit(
  admin: SupabaseClient | null,
  row: SupportAuditInsert
): Promise<void> {
  if (!admin) return;
  const cs =
    row.confidence_score == null
      ? null
      : Math.max(0, Math.min(100, Math.round(Number(row.confidence_score))));
  const { error } = await admin.from('support_audit_log').insert({
    admin_id: row.admin_id ?? null,
    ticket_id: row.ticket_id ?? null,
    action_type: row.action_type,
    metadata: row.metadata ?? {},
    confidence_score: cs,
  });
  if (error) {
    const code = 'code' in error ? String((error as { code: unknown }).code) : '';
    if (code === '42P01') return;
    console.warn('[nexus-audit] insert:', error.message);
  }
}
