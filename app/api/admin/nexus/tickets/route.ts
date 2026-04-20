import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/nexus/tickets — open tickets, sorted by descending severity.
 */
export async function GET() {
  const ta = apiAdminT();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 });

    const { data: rows, error } = await admin
      .from('tickets')
      .select('id, user_id, status, title, created_at, updated_at, gravity_score')
      .eq('status', 'open')
      .order('gravity_score', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const list = rows ?? [];
    if (!list.length) {
      return NextResponse.json({ tickets: [] });
    }

    const userIds = [...new Set(list.map((r) => r.user_id as string))];
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, establishment_name, email')
      .in('id', userIds);

    const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));

    const ticketIds = list.map((t) => t.id as string);
    const { data: auditRows, error: auditErr } = await admin
      .from('support_audit_log')
      .select('ticket_id, confidence_score, created_at')
      .in('ticket_id', ticketIds)
      .eq('action_type', 'diagnostic_bootstrap');

    const confByTicket = new Map<string, number>();
    if (!auditErr && auditRows) {
      const sortedAudits = [...auditRows].sort(
        (a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime()
      );
      for (const row of sortedAudits) {
        const tid = row.ticket_id as string;
        if (tid && !confByTicket.has(tid) && row.confidence_score != null) {
          confByTicket.set(tid, Number(row.confidence_score));
        }
      }
    } else if (auditErr) {
      const code = 'code' in auditErr ? String((auditErr as { code: unknown }).code) : '';
      if (code !== '42P01') console.warn('[nexus tickets] audit confiance:', auditErr.message);
    }

    const tickets = list.map((t) => {
      const p = profileById.get(t.user_id as string);
      const tid = t.id as string;
      return {
        id: tid,
        user_id: t.user_id,
        status: t.status,
        title: t.title,
        created_at: t.created_at,
        updated_at: t.updated_at,
        gravity_score: t.gravity_score ?? null,
        diagnostic_confidence: confByTicket.get(tid) ?? null,
        client_label:
          (p?.establishment_name as string | undefined)?.trim() ||
          (p?.full_name as string | undefined)?.trim() ||
          (p?.email as string | undefined)?.trim()?.slice(0, 40) ||
          String(t.user_id).slice(0, 8) + '…',
      };
    });

    return NextResponse.json({ tickets });
  } catch (e) {
    console.error('[api/admin/nexus/tickets]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('serverError') },
      { status: 500 }
    );
  }
}
