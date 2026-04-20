import type { SupabaseClient } from '@supabase/supabase-js';

export type HealthIntelRow = {
  slug: string;
  title: string;
  customer_summary: string;
  status: string;
  eta_resolution_at: string | null;
};

/**
 * Incidents plateforme actifs (non résolus) — le conseiller peut dire « nous travaillons dessus ».
 */
export async function fetchActiveHealthIntelligence(
  admin: SupabaseClient
): Promise<{ rows: HealthIntelRow[]; markdown: string }> {
  const { data, error } = await admin
    .from('system_health_intelligence')
    .select('slug, title, customer_summary, status, eta_resolution_at')
    .neq('status', 'resolved')
    .eq('is_public', true)
    .order('updated_at', { ascending: false })
    .limit(12);

  if (error) {
    console.warn('[health-intelligence] lecture impossible (table absente ou RLS) :', error.message);
    return { rows: [], markdown: '' };
  }

  const rows = (data ?? []) as HealthIntelRow[];
  if (rows.length === 0) {
    return { rows: [], markdown: '' };
  }

  const lines = rows.map((r) => {
    let eta = '';
    if (r.eta_resolution_at) {
      try {
        eta = ` — ETA annoncée : ${new Date(r.eta_resolution_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`;
      } catch {
        eta = '';
      }
    }
    return `- **${r.title}** (${r.slug}, statut ${r.status})${eta} : ${r.customer_summary}`;
  });

  const markdown =
    '### Incidents ou limitations plateforme connus (vérité REPUTEXA — à communiquer au client si pertinent)\n\n' +
    lines.join('\n');

  return { rows, markdown };
}
