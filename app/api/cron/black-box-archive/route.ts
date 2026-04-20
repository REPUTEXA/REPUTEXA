/**
 * Cron — archivage froid Black Box (gzip → S3/R2 INTELLIGENT_TIERING).
 * GET/POST, Authorization: Bearer CRON_SECRET ou x-vercel-cron: 1
 */

import { NextResponse } from 'next/server';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { runBlackBoxArchivePass } from '@/lib/black-box/archive-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET?.trim();

function checkAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization')?.trim();
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const bearerOk = !!(CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`);
  return bearerOk || isVercelCron;
}

export async function POST(request: Request) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return runCronBody();
}

export async function GET(request: Request) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return runCronBody();
}

async function runCronBody() {
  const ta = apiAdminT();
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  const { data: runRow, error: insErr } = await admin
    .from('black_box_archive_runs')
    .insert({ status: 'running' })
    .select('id')
    .single();

  if (insErr) {
    console.error('[cron/black-box] insert run', insErr);
  }

  const runId = runRow?.id as string | undefined;

  try {
    const summary = await runBlackBoxArchivePass(admin);
    if (runId) {
      await admin
        .from('black_box_archive_runs')
        .update({
          status: 'ok',
          finished_at: new Date().toISOString(),
          batches_written: summary.batches,
          rows_archived: summary.rows,
          bytes_out: summary.bytes,
          detail: {
            skippedReason: summary.skippedReason ?? null,
            skippedDetail: summary.skippedDetail ?? null,
          },
        })
        .eq('id', runId);
    }
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Black Box failed';
    console.error('[cron/black-box]', e);
    if (runId) {
      await admin
        .from('black_box_archive_runs')
        .update({
          status: 'failed',
          finished_at: new Date().toISOString(),
          error_message: msg,
        })
        .eq('id', runId);
    }
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }
}
