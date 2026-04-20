/**
 * Génération complète du rapport PDF performance Banano (stats mois + pilotage + stockage).
 * Utilisé par POST /api/banano/pilotage/reports/generate et le cron mensuel.
 */
import { endOfMonth, subDays } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mergeLostConfig } from '@/lib/banano/banano-automation-defaults';
import { localeFromProfileRow } from '@/lib/i18n/merchant-locale';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import {
  buildPilotageDashboard,
  type LoyaltyEventRow,
  type MemberRow,
} from '@/lib/banano/pilotage/build-pilotage-dashboard';
import { collectBananoPerformanceMonthStats } from '@/lib/banano/pilotage/performance-report-stats';
import { generatePerformanceNarrative } from '@/lib/banano/pilotage/generate-performance-narrative';
import { renderBananoPerformancePdfBuffer } from '@/lib/banano/pilotage/banano-performance-pdf';

export type RunPerformanceReportResult =
  | { ok: true; year: number; month: number; badge: string }
  | { ok: false; error: string };

export async function runBananoPerformanceReportGeneration(
  admin: SupabaseClient,
  userId: string,
  periodStart: Date,
  establishmentName: string
): Promise<RunPerformanceReportResult> {
  const asOf = endOfMonth(periodStart);
  const fromIso = subDays(asOf, 70).toISOString();

  const [evRes, memRes, profRes, ruleRes] = await Promise.all([
    admin
      .from('banano_loyalty_events')
      .select('created_at, event_type, member_id, amount_cents, note, items_count')
      .eq('user_id', userId)
      .gte('created_at', String(fromIso))
      .order('created_at', { ascending: true })
      .limit(12_000),
    admin
      .from('banano_loyalty_members')
      .select('id, display_name, first_name, last_name, lifetime_visit_count, last_visit_at')
      .eq('user_id', userId),
    admin
      .from('profiles')
      .select('banano_pilotage_daily_revenue_goal_cents, banano_pilotage_daily_visit_goal, language')
      .eq('id', userId)
      .maybeSingle(),
    admin
      .from('banano_loyalty_automation_rules')
      .select('config')
      .eq('user_id', userId)
      .eq('rule_type', 'lost_client')
      .maybeSingle(),
  ]);

  if (evRes.error) {
    return { ok: false, error: `Événements fidélité : ${evRes.error.message}` };
  }
  if (memRes.error) {
    return { ok: false, error: `Membres fidélité : ${memRes.error.message}` };
  }

  const siteLocale = localeFromProfileRow(
    (profRes.data as { language?: string } | null)?.language
  );

  const stats = await collectBananoPerformanceMonthStats(admin, userId, periodStart, siteLocale);
  const narrative = await generatePerformanceNarrative(
    establishmentName.trim() || 'Commerce',
    stats,
    siteLocale
  );

  const row = profRes.data as Record<string, unknown> | null;
  const rawRevGoal = row?.banano_pilotage_daily_revenue_goal_cents;
  const dailyRevenueGoalCents =
    rawRevGoal != null && Number(rawRevGoal) > 0 ? Math.floor(Number(rawRevGoal)) : null;
  const rawVisitGoal = row?.banano_pilotage_daily_visit_goal;
  const dailyVisitGoal =
    rawVisitGoal != null && Number(rawVisitGoal) >= 1
      ? Math.min(100_000, Math.floor(Number(rawVisitGoal)))
      : null;

  const lostCfg = mergeLostConfig(
    (ruleRes.data as { config?: Record<string, unknown> } | null)?.config ?? {}
  );

  const pilotageCoreT = createServerTranslator('Dashboard.bananoPilotageCore', siteLocale);
  const pilotageCore = buildPilotageDashboard({
    now: asOf,
    events: (evRes.data ?? []) as LoyaltyEventRow[],
    members: (memRes.data ?? []) as MemberRow[],
    dailyRevenueGoalCents:
      dailyRevenueGoalCents != null && dailyRevenueGoalCents > 0 ? dailyRevenueGoalCents : null,
    dailyVisitGoal: dailyVisitGoal != null && dailyVisitGoal > 0 ? dailyVisitGoal : null,
    inactiveDays: lostCfg.inactive_days,
    minLifetimeVisits: lostCfg.min_lifetime_visits,
    extras: undefined,
    siteLocale,
    pilotageT: (key, values) =>
      pilotageCoreT(key, values as Record<string, string | number | boolean | null | undefined>),
  });

  const buffer = await renderBananoPerformancePdfBuffer({
    establishmentName,
    stats,
    narrative,
    pilotageCore,
    locale: siteLocale,
  });

  const y = periodStart.getFullYear();
  const m = periodStart.getMonth() + 1;
  const path = `${userId}/${y}-${String(m).padStart(2, '0')}.pdf`;

  const { error: upErr } = await admin.storage
    .from('banano-pilotage-reports')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: true });

  if (upErr) {
    console.error('[banano/pilotage/run upload]', upErr.message);
    return { ok: false, error: 'Échec enregistrement du PDF.' };
  }

  const { error: rowErr } = await admin.from('banano_pilotage_performance_reports').upsert(
    {
      user_id: userId,
      month_start: stats.monthStartIso,
      storage_path: path,
      ai_badge: narrative.badge,
      ai_headline: narrative.headline,
    },
    { onConflict: 'user_id,month_start' }
  );

  if (rowErr) {
    console.error('[banano/pilotage/run row]', rowErr.message);
    return { ok: false, error: 'Métadonnées rapport non enregistrées.' };
  }

  return { ok: true, year: y, month: m, badge: narrative.badge };
}
