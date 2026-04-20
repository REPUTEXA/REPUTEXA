/**
 * 1er du mois (UTC) : génère et archive le PDF « dossier conformité » pour le mois civil **précédent**
 * (ex. passage le 2026-04-01 → période 2026-03). Idempotent pour source cron.
 *
 * GET/POST — Authorization: Bearer CRON_SECRET ou x-vercel-cron: 1
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createComplianceBundleArchive, previousUtcMonth } from '@/lib/admin/compliance-bundle-archive';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET?.trim();

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization')?.trim();
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const bearerOk = !!(CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`);
  return bearerOk || isVercelCron;
}

async function run(): Promise<NextResponse> {
  const ta = apiAdminT();
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 503 });
  }

  const { year, month } = previousUtcMonth();
  const result = await createComplianceBundleArchive(admin, {
    year,
    month,
    signedBy: null,
    source: 'cron',
    createdByUserId: null,
    skipIfCronExists: true,
  });

  if (!result.ok) {
    console.error('[cron/compliance-bundle-monthly]', result.error);
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }

  if ('skipped' in result && result.skipped) {
    const period = `${year}-${String(month).padStart(2, '0')}`;
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: ta('complianceBundleCronSkippedAlreadyPresent', { period }),
      period: { year, month },
    });
  }

  if (!('id' in result)) {
    return NextResponse.json({ error: ta('complianceBundleCronUnexpectedResponse') }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    period: { year, month },
  });
}

export async function GET(request: Request) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return run();
}

export async function POST(request: Request) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return run();
}
