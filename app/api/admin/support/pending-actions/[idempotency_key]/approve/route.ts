import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import {
  executeTool,
  coercePendingToolInput,
  type ToolName,
} from '@/lib/support/agent-tools';
import { logSupportAudit } from '@/lib/support/nexus-audit';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ idempotency_key: string }> };

/**
 * POST /api/admin/support/pending-actions/[idempotency_key]/approve
 * Exécute réellement une action WRITE Nexus après validation humaine (role admin).
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
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 });

    const { data: row, error: fetchErr } = await admin
      .from('support_pending_actions')
      .select('id, status, tool_name, tool_input, ticket_id, target_user_id')
      .eq('idempotency_key', key)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!row) return NextResponse.json({ error: ta('supportPendingActionNotFound') }, { status: 404 });
    if (row.status !== 'pending') {
      return NextResponse.json(
        { error: ta('supportPendingActionNotPending'), status: row.status },
        { status: 409 }
      );
    }

    const toolName = row.tool_name as ToolName;
    const input = coercePendingToolInput(row.tool_input);
    const mergedInput = input.user_id ? input : { ...input, user_id: row.target_user_id as string };

    const result = await executeTool(admin, toolName, mergedInput);

    if (!result.success) {
      await logSupportAudit(admin, {
        admin_id: user.id,
        ticket_id: row.ticket_id as string,
        action_type: 'tool_write_approval_exec_failed',
        metadata: {
          idempotency_key: key,
          tool_name: toolName,
          summary: result.summary.slice(0, 6000),
        },
      });
      return NextResponse.json(
        { error: ta('supportPendingActionExecFailed'), result },
        { status: 422 }
      );
    }

    const { error: updErr } = await admin
      .from('support_pending_actions')
      .update({
        status: 'executed',
        executed_at: new Date().toISOString(),
        approved_by: user.id,
      })
      .eq('idempotency_key', key)
      .eq('status', 'pending');

    if (updErr) throw updErr;

    await logSupportAudit(admin, {
      admin_id: user.id,
      ticket_id: row.ticket_id as string,
      action_type: 'tool_write_approved',
      metadata: {
        idempotency_key: key,
        tool_name: toolName,
        tool_success: result.success,
        summary_excerpt: result.summary.slice(0, 2000),
      },
    });

    return NextResponse.json({
      ok: true,
      result: {
        tool: result.tool,
        success: result.success,
        summary: result.summary,
      },
    });
  } catch (e) {
    console.error('[admin/support/pending-actions/approve]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('serverError') },
      { status: 500 }
    );
  }
}
