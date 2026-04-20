import { createTranslator } from 'next-intl';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';

export type CouncilTranscriptTurn = {
  agent_key: string;
  label: string;
  message: string;
};

function adminCouncilT() {
  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  return createTranslator({ locale, messages, namespace: 'Admin' });
}

/**
 * Tick cron : agrège l’état de plusieurs « agents » admin (données déjà en base).
 * Ne lance pas d’appels IA ni d’actions — journal uniquement.
 */
export async function runAdminCouncilDigestTick(
  admin: SupabaseClient
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const t = adminCouncilT();
  const transcript: CouncilTranscriptTurn[] = [];
  const meta: Record<string, unknown> = { at: new Date().toISOString() };

  const since = new Date();
  since.setHours(since.getHours() - 24);

  const { data: guardian } = await admin
    .from('legal_guardian_state')
    .select('last_run_at, last_status, last_summary')
    .eq('id', 1)
    .maybeSingle();

  if (guardian) {
    transcript.push({
      agent_key: 'guardian',
      label: t('councilDigest.labelGuardian'),
      message: t('councilDigest.msgGuardian', {
        status: String(guardian.last_status ?? '—'),
        summary: String(guardian.last_summary ?? '').slice(0, 500),
      }),
    });
    meta.guardian_status = guardian.last_status;
    meta.guardian_last_run_at = guardian.last_run_at;
  }

  const { count: degIncidents } = await admin
    .from('system_incidents')
    .select('id', { head: true, count: 'exact' })
    .eq('status', 'degraded')
    .gte('created_at', since.toISOString());

  const { count: critIncidents } = await admin
    .from('system_incidents')
    .select('id', { head: true, count: 'exact' })
    .eq('status', 'critical')
    .gte('created_at', since.toISOString());

  transcript.push({
    agent_key: 'sentinel',
    label: t('councilDigest.labelSentinel'),
    message: t('councilDigest.msgSentinel', {
      deg: String(degIncidents ?? 0),
      crit: String(critIncidents ?? 0),
    }),
  });
  meta.incidents_degraded_24h = degIncidents ?? 0;
  meta.incidents_critical_24h = critIncidents ?? 0;

  const { data: babelRow } = await admin
    .from('ia_forge_metric_daily')
    .select('day, conversion_pct')
    .eq('agent_key', 'babel')
    .order('day', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (babelRow && babelRow.conversion_pct != null) {
    transcript.push({
      agent_key: 'babel',
      label: t('councilDigest.labelBabel'),
      message: t('councilDigest.msgBabel', {
        pct: Number(babelRow.conversion_pct),
        day: babelRow.day,
      }),
    });
    meta.babel_conversion_day = babelRow.day;
    meta.babel_conversion_pct = babelRow.conversion_pct;
  } else {
    transcript.push({
      agent_key: 'babel',
      label: t('councilDigest.labelBabel'),
      message: t('councilDigest.msgBabelEmpty'),
    });
  }

  transcript.push({
    agent_key: 'nexus',
    label: t('councilDigest.labelNexus'),
    message: t('councilDigest.msgNexus'),
  });

  const consensusParts: string[] = [];
  if ((critIncidents ?? 0) > 0) {
    consensusParts.push(t('councilDigest.consensusCritical'));
  }
  if (guardian?.last_status === 'review_needed') {
    consensusParts.push(t('councilDigest.consensusGuardianReview'));
  }
  if (consensusParts.length === 0) {
    consensusParts.push(t('councilDigest.consensusRas'));
  }
  const consensus_note = consensusParts.join(' ');

  const { data: ins, error } = await admin
    .from('admin_council_digest')
    .insert({
      tick_kind: 'scheduled',
      transcript,
      consensus_note,
      meta,
    })
    .select('id')
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: ins?.id as string | undefined };
}
