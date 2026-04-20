import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { persistLearningOnArchive } from '@/lib/support/ticket-archive-learning';

function isMissingColumn(e: unknown, col: string): boolean {
  if (!e || typeof e !== 'object') return false;
  const msg = 'message' in e ? String((e as { message: unknown }).message) : '';
  const code = 'code' in e ? String((e as { code: unknown }).code) : '';
  return code === '42703' || (msg.includes('column') && msg.includes(col));
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    let { data: ticket, error: tErr } = await supabase
      .from('tickets')
      .select('id, status, title, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (tErr && isMissingColumn(tErr, 'title')) {
      ({ data: ticket, error: tErr } = await supabase
        .from('tickets')
        .select('id, status, created_at, updated_at')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle());
    }

    if (tErr) throw tErr;
    if (!ticket) return apiJsonError(request, 'errors.resourceNotFoundShort', 404);
    if (!('title' in ticket)) Object.assign(ticket, { title: null });

    const { data: messageRows, error: mErr } = await supabase
      .from('ticket_messages')
      .select('id, sender, content, created_at')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    if (mErr) throw mErr;

    return NextResponse.json({
      ticket,
      messages: messageRows ?? [],
    });
  } catch (e) {
    console.error('[api/support/tickets/[id] GET]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    const body = (await request.json().catch(() => ({}))) as {
      status?: string;
      title?: string;
      verdict_problem?: string;
      verdict_solution?: string;
    };

    // ── Renommage du titre ──────────────────────────────────────────────────
    if (body.title !== undefined) {
      const newTitle = String(body.title).trim().slice(0, 120) || null;
      const { data: ticket, error } = await supabase
        .from('tickets')
        .update({ title: newTitle })
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id, status, title, created_at, updated_at')
        .single();

      // Si la colonne n'existe pas encore, on répond quand même sans crasher
      if (error && isMissingColumn(error, 'title')) {
        console.warn('[tickets PATCH] colonne title absente — renommage ignoré');
        return NextResponse.json({ ticket: { id, title: newTitle, status: 'open', created_at: '', updated_at: '' } });
      }
      if (error) throw error;
      if (!ticket) return apiJsonError(request, 'errors.resourceNotFoundShort', 404);
      return NextResponse.json({ ticket });
    }

    // ── Changement de statut ────────────────────────────────────────────────
    const nextStatus = body.status;
    if (nextStatus !== 'archived' && nextStatus !== 'open') {
      return apiJsonError(request, 'errors.support_ticketStatusOrTitleRequired', 400);
    }

    const { data: before } = await supabase
      .from('tickets')
      .select('status')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!before) return apiJsonError(request, 'errors.resourceNotFoundShort', 404);

    let { data: ticket, error } = await supabase
      .from('tickets')
      .update({ status: nextStatus })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, status, title, created_at, updated_at')
      .single();

    if (error && isMissingColumn(error, 'title')) {
      ({ data: ticket, error } = await supabase
        .from('tickets')
        .update({ status: nextStatus })
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id, status, created_at, updated_at')
        .single());
    }

    if (error) throw error;

    if (before.status === 'open' && nextStatus === 'archived') {
      const vp = String(body.verdict_problem ?? '').trim();
      const vs = String(body.verdict_solution ?? '').trim();
      const humanVerdict = vp && vs ? { problem: vp, solution: vs } : undefined;
      try {
        await persistLearningOnArchive(id, user.id, humanVerdict ? { humanVerdict } : undefined);
      } catch (learnErr) {
        console.error('[support] Apprentissage archivage:', learnErr);
      }
    }

    return NextResponse.json({ ticket });
  } catch (e) {
    console.error('[api/support/tickets/[id] PATCH]', e);
    return apiJsonError(request, 'serverError', 500);
  }
}
