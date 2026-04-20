import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiJsonError } from '@/lib/api/api-error-response';
import {
  loadSentinel360Config,
  runSentinel360Audit,
  saveSentinel360Config,
  shouldRunAutoScan,
} from '@/lib/admin/sentinel-360-audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET;

function checkAuth(request: Request): boolean {
  return !!(CRON_SECRET && request.headers.get('authorization') === `Bearer ${CRON_SECRET}`);
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return apiJsonError(request, 'unauthorized', 401);
  }
  return runCronBody(request);
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return apiJsonError(request, 'unauthorized', 401);
  }
  return runCronBody(request);
}

async function runCronBody(request: Request) {
  const admin = createAdminClient();
  if (!admin) {
    return apiJsonError(request, 'supabaseAdminNotConfigured', 500);
  }

  const config = await loadSentinel360Config(admin);
  if (!shouldRunAutoScan(config)) {
    return NextResponse.json({ skipped: true, reason: 'frequency_or_cooldown', config });
  }

  try {
    const report = await runSentinel360Audit(admin, { logToCompliance: true });
    const next = await saveSentinel360Config(admin, { lastAutoScanAt: report.scannedAt });
    return NextResponse.json({
      ok: true,
      scannedAt: report.scannedAt,
      summaryCounts: report.summaryCounts,
      schedule: next,
    });
  } catch (e) {
    console.error('[cron/sentinel-360]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'scan failed' },
      { status: 500 }
    );
  }
}
