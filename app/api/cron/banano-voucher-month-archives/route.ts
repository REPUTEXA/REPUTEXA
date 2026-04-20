/**
 * Cron : 1er de chaque mois à 8h UTC — archives CSV des bons fidélité + collaborateurs
 * pour le mois calendaire précédent (même créneau que le rapport performance IA).
 */

import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { runBananoVoucherMonthArchiveGeneration } from '@/lib/banano/run-voucher-month-archive-generation';

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
  const startIso = periodStart.toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const endIso = monthEnd.toISOString();

  const { data: touchRows, error: touchErr } = await admin
    .from('banano_loyalty_vouchers')
    .select('user_id')
    .lte('created_at', endIso)
    .or(`redeemed_at.is.null,redeemed_at.gte.${startIso}`)
    .limit(60_000);

  if (touchErr) {
    console.error('[cron/banano-voucher-month-archives] scan', touchErr.message);
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }

  const userIds = [...new Set((touchRows ?? []).map((r) => r.user_id as string))];

  let archivesWritten = 0;
  let errors = 0;

  for (const userId of userIds) {
    for (const kind of ['loyalty_threshold', 'staff_allowance'] as const) {
      const result = await runBananoVoucherMonthArchiveGeneration(admin, userId, periodStart, kind);
      if (result.ok) {
        if (!result.skipped) archivesWritten += 1;
      } else {
        errors += 1;
        console.error('[cron/banano-voucher-month-archives] failed', userId, kind, result.error);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    period: periodStart.toISOString().slice(0, 7),
    merchants: userIds.length,
    archivesWritten,
    errors,
  });
}
