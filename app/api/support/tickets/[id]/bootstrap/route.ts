import { NextRequest, NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSupportBootstrapGreeting } from '@/lib/support/bootstrap-greeting';
import { buildNexusBootstrapDiagnostic } from '@/lib/support/nexus-diagnostic';
import { logSupportAudit } from '@/lib/support/nexus-audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/support/tickets/[id]/bootstrap
 * À l’ouverture d’un ticket sans message : génère le premier message du conseiller
 * (signaux compte + incidents plateforme connus).
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { id: ticketId } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    const body = (await request.json().catch(() => ({}))) as { locale?: string };
    const locale = typeof body.locale === 'string' ? body.locale : 'fr';

    const { data: ticket, error: tErr } = await supabase
      .from('tickets')
      .select('id, user_id, status')
      .eq('id', ticketId)
      .maybeSingle();

    if (tErr) throw tErr;
    if (!ticket || ticket.user_id !== user.id) {
      return apiJsonError(request, 'errors.resourceNotFoundShort', 404);
    }
    if (ticket.status !== 'open') {
      return apiJsonError(request, 'errors.ticketNotEditable', 409);
    }

    const admin = createAdminClient();
    if (!admin) {
      return apiJsonError(request, 'serviceUnavailable', 503);
    }

    const { count, error: cErr } = await admin
      .from('ticket_messages')
      .select('id', { count: 'exact', head: true })
      .eq('ticket_id', ticketId);

    if (cErr) throw cErr;
    if (count && count > 0) {
      await admin
        .from('tickets')
        .update({ support_bootstrap_done: true })
        .eq('id', ticketId)
        .eq('user_id', user.id);
      return NextResponse.json({ skipped: true, reason: 'already_has_messages' }, { status: 200 });
    }

    /** Réserve atomique : une seule requête parallèle gagne le droit d’insérer le greeting */
    const { data: claimed, error: claimErr } = await admin
      .from('tickets')
      .update({ support_bootstrap_done: true })
      .eq('id', ticketId)
      .eq('user_id', user.id)
      .eq('support_bootstrap_done', false)
      .select('id')
      .maybeSingle();

    if (claimErr) throw claimErr;
    if (!claimed) {
      return NextResponse.json({ skipped: true, reason: 'bootstrap_already_claimed' }, { status: 200 });
    }

    let greeting: string;
    const nexus = await buildNexusBootstrapDiagnostic({ admin, userId: user.id });
    await logSupportAudit(admin, {
      ticket_id: ticketId,
      action_type: 'diagnostic_bootstrap',
      confidence_score: nexus.confidence_score,
      metadata: {
        scanner_user_id: user.id,
        gravity_score: nexus.gravity_score,
        FACTS: nexus.FACTS,
        DOUBTS: nexus.DOUBTS,
        SUGGESTED_ACTION: nexus.SUGGESTED_ACTION,
      },
    });

    const { error: gravErr } = await admin
      .from('tickets')
      .update({ gravity_score: nexus.gravity_score })
      .eq('id', ticketId)
      .eq('user_id', user.id);
    if (gravErr) {
      const code = 'code' in gravErr ? String((gravErr as { code: unknown }).code) : '';
      if (code !== '42703') console.warn('[bootstrap] gravity_score:', gravErr.message);
    }

    try {
      greeting = await generateSupportBootstrapGreeting({
        admin,
        userId: user.id,
        locale,
      });
    } catch (e) {
      await admin
        .from('tickets')
        .update({ support_bootstrap_done: false })
        .eq('id', ticketId);
      throw e;
    }

    const { error: insErr } = await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender: 'ai',
      content: greeting,
    });
    if (insErr) {
      await admin
        .from('tickets')
        .update({ support_bootstrap_done: false })
        .eq('id', ticketId);
      throw insErr;
    }

    return NextResponse.json({
      message: greeting,
      actions: [] as { name: string; label: string; success: boolean; icon: string }[],
      nexus: {
        FACTS: nexus.FACTS,
        DOUBTS: nexus.DOUBTS,
        SUGGESTED_ACTION: nexus.SUGGESTED_ACTION,
        confidence_score: nexus.confidence_score,
        gravity_score: nexus.gravity_score,
      },
    });
  } catch (e) {
    console.error('[api/support/tickets/bootstrap]', e);
    return apiJsonError(request, 'serverError', 500);
  }
}
