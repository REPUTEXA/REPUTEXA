/**
 * Cron : 1er de chaque mois à 8h (UTC sur Vercel) — génère le PDF « performance IA » Banano
 * pour le mois calendaire précédent, pour les comptes Zenith.
 *
 * Même créneau que /api/cron/monthly-report (0 8 1 * *).
 */

import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { toPlanSlug } from '@/lib/feature-gate';
import { runBananoPerformanceReportGeneration } from '@/lib/banano/pilotage/run-performance-report-generation';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  const ta = apiAdminT();
  const auth = request.headers.get('authorization');
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('supabaseAdminMissing') }, { status: 500 });
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, establishment_name, subscription_plan, selected_plan');

  if (error) {
    console.error('[cron/banano-pilotage-performance-report] profiles', error.message);
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }

  if (!profiles?.length) {
    return NextResponse.json({ ok: true, processed: 0, errors: 0 });
  }

  let processed = 0;
  let errors = 0;

  for (const p of profiles) {
    const planSlug = toPlanSlug(
      p.subscription_plan as string | null,
      p.selected_plan as string | null
    );
    if (planSlug !== 'zenith') continue;

    const userId = p.id as string;
    const establishmentName = String((p as { establishment_name?: string }).establishment_name ?? '');

    const result = await runBananoPerformanceReportGeneration(admin, userId, periodStart, establishmentName);
    if (result.ok) {
      processed += 1;
    } else {
      errors += 1;
      console.error('[cron/banano-pilotage-performance-report] failed', userId, result.error);
    }
  }

  return NextResponse.json({ ok: true, period: periodStart.toISOString().slice(0, 7), processed, errors });
}
