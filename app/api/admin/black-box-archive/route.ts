import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runBlackBoxArchivePass } from '@/lib/black-box/archive-engine';
import { getBlackBoxS3Config } from '@/lib/black-box/s3-io';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function requireAdmin() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 }) };
  }
  return { admin } as const;
}

function escapeIlike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * GET ?q=&from=&to=&table=&limit= — index Time Machine
 * GET ?runs=1 — derniers jobs
 */
export async function GET(request: Request) {
  const ta = apiAdminT();
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;
  const { admin } = gate;

  const { searchParams } = new URL(request.url);

  if (searchParams.get('meta') === '1') {
    const hotRetentionDays = Math.max(
      7,
      Math.min(365, Number(process.env.BLACK_BOX_HOT_RETENTION_DAYS ?? '30') || 30)
    );
    return NextResponse.json({
      archiveEnabled: process.env.BLACK_BOX_ARCHIVE_ENABLED !== '0',
      s3Configured: !!getBlackBoxS3Config(),
      hotRetentionDays,
    });
  }

  if (searchParams.get('stats') === '1') {
    const [{ count: indexCount, error: cErr }, { data: lastRun, error: rErr }] = await Promise.all([
      admin.from('black_box_archive_index').select('id', { head: true, count: 'exact' }),
      admin
        .from('black_box_archive_runs')
        .select(
          'id, started_at, finished_at, status, batches_written, rows_archived, bytes_out, error_message'
        )
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }
    if (rErr) {
      return NextResponse.json({ error: rErr.message }, { status: 500 });
    }
    return NextResponse.json({
      indexCount: indexCount ?? 0,
      lastRun: lastRun ?? null,
    });
  }

  if (searchParams.get('runs') === '1') {
    const { data, error } = await admin
      .from('black_box_archive_runs')
      .select(
        'id, started_at, finished_at, status, batches_written, rows_archived, bytes_out, error_message, detail'
      )
      .order('started_at', { ascending: false })
      .limit(15);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ runs: data ?? [] });
  }

  const q = searchParams.get('q')?.trim() ?? '';
  const from = searchParams.get('from')?.trim();
  const to = searchParams.get('to')?.trim();
  const table = searchParams.get('table')?.trim();
  const limit = Math.min(80, Math.max(1, parseInt(searchParams.get('limit') ?? '40', 10) || 40));

  try {
    let query = admin
      .from('black_box_archive_index')
      .select(
        'id, source_kind, source_table, occurred_at_min, occurred_at_max, row_count, user_ids, search_text, s3_bucket, s3_key, gzip_bytes, approx_plain_bytes, hot_deleted, ai_summary, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (table) {
      query = query.eq('source_table', table);
    }
    if (from && to) {
      query = query.lte('occurred_at_min', to).gte('occurred_at_max', from);
    } else if (from) {
      query = query.gte('occurred_at_max', from);
    } else if (to) {
      query = query.lte('occurred_at_min', to);
    }
    if (q.length >= 2) {
      query = query.ilike('search_text', `%${escapeIlike(q)}%`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: error.message, hint: ta('blackBoxMigration142Required') },
        { status: 500 }
      );
    }
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    console.error('[admin/black-box GET]', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : ta('serverError') }, { status: 500 });
  }
}

/** POST — déclenche un passage d'archivage manuel */
export async function POST() {
  const ta = apiAdminT();
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;
  const { admin } = gate;

  const { data: runRow, error: insErr } = await admin
    .from('black_box_archive_runs')
    .insert({ status: 'running', detail: { trigger: 'admin_manual' } })
    .select('id')
    .single();

  if (insErr) {
    console.warn('[admin/black-box] run insert', insErr.message);
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
            trigger: 'admin_manual',
            skippedReason: summary.skippedReason ?? null,
            skippedDetail: summary.skippedDetail ?? null,
          },
        })
        .eq('id', runId);
    }
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : ta('blackBoxArchiveFailed');
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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
