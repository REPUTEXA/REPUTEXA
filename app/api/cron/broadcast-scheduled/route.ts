/**
 * POST/GET /api/cron/broadcast-scheduled
 * Traite les envois d’information planifiés (pas de préavis 30 j).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendEmail } from '@/lib/resend';
import { executeBroadcastSendAll } from '@/lib/admin/broadcast-email-send-all';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

function checkAuth(request: Request): boolean {
  return !!(CRON_SECRET && request.headers.get('authorization') === `Bearer ${CRON_SECRET}`);
}

export async function POST(request: NextRequest) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return runScheduledBroadcasts(ta);
}

export async function GET(request: NextRequest) {
  const ta = apiAdminT();
  if (!checkAuth(request)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  return runScheduledBroadcasts(ta);
}

async function runScheduledBroadcasts(ta: ReturnType<typeof apiAdminT>) {
  if (!canSendEmail()) {
    return NextResponse.json({ error: ta('broadcastResendMissing'), ok: false }, { status: 503 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('broadcastSupabaseMissing'), ok: false }, { status: 500 });
  }

  const nowIso = new Date().toISOString();

  const { data: jobs, error: selErr } = await admin
    .from('admin_broadcast_scheduled')
    .select('id, subject_fr, html_fr, fingerprint')
    .eq('status', 'pending')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(3);

  if (selErr) {
    if (String(selErr.message).includes('admin_broadcast_scheduled')) {
      return NextResponse.json({ ok: true, processed: 0, note: 'table_absent' });
    }
    console.error('[cron/broadcast-scheduled]', selErr);
    return NextResponse.json({ error: ta('serverError'), ok: false }, { status: 500 });
  }

  const list = jobs ?? [];
  let processed = 0;

  for (const job of list) {
    const id = job.id as string;
    const subjectFr = String(job.subject_fr ?? '');
    const htmlFr = String(job.html_fr ?? '');

    const { error: lockErr } = await admin
      .from('admin_broadcast_scheduled')
      .update({ status: 'processing' })
      .eq('id', id)
      .eq('status', 'pending');

    if (lockErr) {
      console.warn('[cron/broadcast-scheduled] lock skip', id, lockErr.message);
      continue;
    }

    try {
      const { emailsSent, emailsFailed, totalUsers } = await executeBroadcastSendAll(admin, subjectFr, htmlFr);
      await admin
        .from('admin_broadcast_scheduled')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          emails_sent: emailsSent,
          emails_failed: emailsFailed,
          total_users: totalUsers,
          error_message: null,
        })
        .eq('id', id);
      processed++;
      console.log(`[cron/broadcast-scheduled] sent job ${id} — ${emailsSent}/${totalUsers}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin
        .from('admin_broadcast_scheduled')
        .update({
          status: 'failed',
          error_message: msg.slice(0, 2000),
        })
        .eq('id', id);
      console.error('[cron/broadcast-scheduled] job fail', id, msg);
    }
  }

  return NextResponse.json({ ok: true, processed, pendingBatchSize: list.length });
}
