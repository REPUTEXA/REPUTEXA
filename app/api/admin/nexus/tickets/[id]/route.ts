import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/nexus/tickets/[id] — fil du ticket + actions pending (HITL).
 */
export async function GET(_request: Request, context: Ctx) {
  const ta = apiAdminT();
  try {
    const { id: ticketId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return NextResponse.json({ error: ta('forbidden') }, { status: 403 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 });

    const { data: ticket, error: tErr } = await admin
      .from('tickets')
      .select('id, user_id, status, title, created_at, updated_at, gravity_score')
      .eq('id', ticketId)
      .maybeSingle();

    if (tErr) throw tErr;
    if (!ticket) return NextResponse.json({ error: ta('notFound') }, { status: 404 });

    const { data: pRow } = await admin
      .from('profiles')
      .select('full_name, establishment_name, email')
      .eq('id', ticket.user_id as string)
      .maybeSingle();

    const { data: messages, error: mErr } = await admin
      .from('ticket_messages')
      .select('id, sender, content, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (mErr) throw mErr;

    const { data: pendingRows } = await admin
      .from('support_pending_actions')
      .select('idempotency_key, tool_name, status, created_at')
      .eq('ticket_id', ticketId)
      .eq('status', 'pending');

    const { data: auditRow, error: auditErr } = await admin
      .from('support_audit_log')
      .select('metadata, confidence_score, created_at')
      .eq('ticket_id', ticketId)
      .eq('action_type', 'diagnostic_bootstrap')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    type Meta = {
      FACTS?: unknown;
      DOUBTS?: unknown;
      SUGGESTED_ACTION?: unknown;
      gravity_score?: number;
      confidence_score?: number;
    };

    let nexus_diagnostic: {
      FACTS: unknown[];
      DOUBTS: unknown[];
      SUGGESTED_ACTION: unknown;
      confidence_score: number | null;
      scanned_at: string;
    } | null = null;

    if (!auditErr && auditRow) {
      const meta = (auditRow.metadata ?? {}) as Meta;
      if (meta.FACTS || meta.DOUBTS) {
        nexus_diagnostic = {
          FACTS: Array.isArray(meta.FACTS) ? meta.FACTS : [],
          DOUBTS: Array.isArray(meta.DOUBTS) ? meta.DOUBTS : [],
          SUGGESTED_ACTION: meta.SUGGESTED_ACTION ?? null,
          confidence_score:
            typeof auditRow.confidence_score === 'number'
              ? auditRow.confidence_score
              : typeof meta.confidence_score === 'number'
                ? meta.confidence_score
                : null,
          scanned_at: auditRow.created_at as string,
        };
      }
    } else if (auditErr) {
      const code = 'code' in auditErr ? String((auditErr as { code: unknown }).code) : '';
      if (code !== '42P01') console.warn('[nexus ticket GET] audit log:', auditErr.message);
    }

    return NextResponse.json({
      ticket: {
        ...ticket,
        client_label:
          (pRow?.establishment_name as string | undefined)?.trim() ||
          (pRow?.full_name as string | undefined)?.trim() ||
          (pRow?.email as string | undefined)?.trim()?.slice(0, 48) ||
          String(ticket.user_id).slice(0, 8) + '…',
      },
      messages: messages ?? [],
      pending_approvals: (pendingRows ?? []).map((r) => ({
        idempotency_key: r.idempotency_key as string,
        tool: r.tool_name as string,
        created_at: r.created_at,
      })),
      nexus_diagnostic,
    });
  } catch (e) {
    console.error('[api/admin/nexus/tickets/[id]]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('serverError') },
      { status: 500 }
    );
  }
}
