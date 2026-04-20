import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logSupportAudit } from '@/lib/support/nexus-audit';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ idempotency_key: string }> };

/**
 * POST /api/admin/support/pending-actions/[idempotency_key]/reject — annule une proposition WRITE.
 */
export async function POST(_request: Request, context: Ctx) {
  const ta = apiAdminT();
  try {
    const { idempotency_key: rawKey } = await context.params;
    const key = decodeURIComponent(String(rawKey ?? '').trim());
    if (!key) return NextResponse.json({ error: ta('supportPendingIdempotencyKeyMissing') }, { status: 400 });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 });

    const { data: row, error: fetchErr } = await admin
      .from('support_pending_actions')
      .select('ticket_id, tool_name, status')
      .eq('idempotency_key', key)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!row) return NextResponse.json({ error: ta('supportPendingActionNotFound') }, { status: 404 });
    if (row.status !== 'pending') {
      return NextResponse.json({ error: ta('supportPendingActionNotPendingShort'), status: row.status }, { status: 409 });
    }

    const { error: updErr } = await admin
      .from('support_pending_actions')
      .update({ status: 'cancelled' })
      .eq('idempotency_key', key)
      .eq('status', 'pending');

    if (updErr) throw updErr;

    await logSupportAudit(admin, {
      admin_id: user.id,
      ticket_id: row.ticket_id as string,
      action_type: 'tool_write_rejected',
      metadata: { idempotency_key: key, tool_name: row.tool_name },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[admin/support/pending-actions/reject]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('serverError') },
      { status: 500 }
    );
  }
}
