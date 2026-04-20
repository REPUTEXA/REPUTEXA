import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { persistLearningOnArchive } from '@/lib/support/ticket-archive-learning';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/nexus/tickets/[id]/archive — admin closure + verdicts (human text → RAG).
 */
export async function POST(request: Request, context: Ctx) {
  const ta = apiAdminT();
  try {
    const { id: ticketId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      verdict_problem?: string;
      verdict_solution?: string;
    };

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
      .select('id, user_id, status')
      .eq('id', ticketId)
      .maybeSingle();

    if (tErr) throw tErr;
    if (!ticket) return NextResponse.json({ error: ta('notFound') }, { status: 404 });
    if (ticket.status !== 'open') {
      return NextResponse.json({ error: ta('nexusTicketAlreadyClosed') }, { status: 409 });
    }

    const vp = String(body.verdict_problem ?? '').trim();
    const vs = String(body.verdict_solution ?? '').trim();
    if (!vp || !vs) {
      return NextResponse.json({ error: ta('nexusVerdictsRequired') }, { status: 400 });
    }

    const { error: updErr } = await admin.from('tickets').update({ status: 'archived' }).eq('id', ticketId);

    if (updErr) throw updErr;

    try {
      await persistLearningOnArchive(ticketId, ticket.user_id as string, {
        humanVerdict: { problem: vp, solution: vs },
      });
    } catch (learnErr) {
      console.error('[nexus-archive] apprentissage:', learnErr);
      return NextResponse.json(
        { error: learnErr instanceof Error ? learnErr.message : ta('nexusLearnPersistFailed') },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[api/admin/nexus/tickets/archive]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('serverError') },
      { status: 500 }
    );
  }
}
