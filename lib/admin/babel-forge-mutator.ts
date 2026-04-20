import { createTranslator } from 'next-intl';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { internalOpsMessageLocale } from '@/lib/admin/internal-ops-locale';

/**
 * Met à jour le contexte Forge Babel à partir des métriques quotidiennes (pilotage objectifs).
 * Activé avec FORGE_BABEL_AUTOPILOT=1 (ex. après cron Forge batch).
 */
export async function applyBabelTemplateEvolutionFromMetrics(admin: SupabaseClient): Promise<boolean> {
  if (process.env.FORGE_BABEL_AUTOPILOT !== '1') return false;

  const { data: rows, error } = await admin
    .from('ia_forge_metric_daily')
    .select('conversion_pct, day')
    .eq('agent_key', 'babel')
    .not('conversion_pct', 'is', null)
    .order('day', { ascending: false })
    .limit(12);

  if (error || !rows?.length) return false;

  const locale = internalOpsMessageLocale();
  const messages = getServerMessagesForLocale(locale);
  const t = createTranslator({ locale, messages, namespace: 'Admin' });

  const latest = Number(rows[0].conversion_pct);
  const prev = rows.length > 1 ? Number(rows[1].conversion_pct) : latest;
  const trendWord =
    latest > prev
      ? t('babelForgeMutator.trendUp')
      : latest < prev
        ? t('babelForgeMutator.trendDown')
        : t('babelForgeMutator.trendFlat');

  const content = [
    t('babelForgeMutator.line1', { trend: trendWord }),
    t('babelForgeMutator.line2', {
      latest,
      day: rows[0].day,
      prev,
    }),
    t('babelForgeMutator.priorityLine'),
    t('babelForgeMutator.timeLine', { iso: new Date().toISOString() }),
  ].join(' ');

  const { error: upErr } = await admin.from('ia_forge_context_store').upsert({
    key: 'babel_pitch_addon',
    content: content.slice(0, 4000),
    updated_at: new Date().toISOString(),
  });

  return !upErr;
}
