import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractLearningFromTranscript } from '@/lib/support/learning-extraction';
import { embedText } from '@/lib/support/embeddings';
import { toVectorParam } from '@/lib/support/vector';

function isMissingColumn(e: unknown, col: string): boolean {
  if (!e || typeof e !== 'object') return false;
  const msg  = ('message' in e ? String((e as { message: unknown }).message) : '');
  const code = ('code'    in e ? String((e as { code:    unknown }).code)    : '');
  return code === '42703' || (msg.includes('column') && msg.includes(col));
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

async function persistLearningOnArchive(ticketId: string, userId: string) {
  const admin = createAdminClient();
  if (!admin) {
    console.warn('[support] Pas de service role — apprentissage ignoré');
    return;
  }

  const { data: ticket } = await admin
    .from('tickets')
    .select('id, user_id')
    .eq('id', ticketId)
    .single();

  if (!ticket || ticket.user_id !== userId) return;

  const { data: rows } = await admin
    .from('ticket_messages')
    .select('sender, content, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  const messages = (rows ?? []).map((r) => ({
    sender: r.sender as string,
    content: String(r.content ?? ''),
  }));

  if (messages.length === 0) return;

  const extracted = await extractLearningFromTranscript(messages);
  const isGold    = extracted.gold_standard_score >= 8;

  const summaryText = [extracted.root_cause, extracted.effective_solution, extracted.prevention].join('\n\n');

  let embeddingLiteral: string | null = null;
  try {
    const vec = await embedText(summaryText);
    embeddingLiteral = toVectorParam(vec);
  } catch (err) {
    console.error('[support] Embedding apprentissage:', err);
  }

  // ── Mémoire positive : ai_learning_knowledge ──────────────────────────────
  const knowledgePayload = {
    source_ticket_id:    ticketId,
    root_cause:          extracted.root_cause,
    effective_solution:  extracted.effective_solution,
    prevention:          extracted.prevention,
    summary_embedding:   embeddingLiteral,
    is_gold_standard:    isGold,
    gold_standard_score: extracted.gold_standard_score,
    tool_used:           extracted.tool_used ?? null,
  };

  const { error: knowledgeErr } = await admin.from('ai_learning_knowledge').upsert(knowledgePayload, {
    onConflict: 'source_ticket_id',
  });

  if (knowledgeErr) {
    console.error('[support] Upsert ai_learning_knowledge:', knowledgeErr.message);
    throw knowledgeErr;
  }

  if (isGold) {
    console.info(`[support] GOLD STANDARD (score ${extracted.gold_standard_score}/10) enregistré pour ticket ${ticketId}`);
  } else {
    console.info(`[support] Apprentissage enregistré (score ${extracted.gold_standard_score}/10) pour ticket ${ticketId}`);
  }

  // ── Mémoire négative : ai_learning_feedback (si erreur agent détectée) ────
  if (extracted.feedback) {
    const fb = extracted.feedback;
    const fbText = [fb.error_pattern, fb.root_mistake, fb.correct_approach].join('\n\n');
    let fbEmbedding: string | null = null;
    try {
      const vec = await embedText(fbText);
      fbEmbedding = toVectorParam(vec);
    } catch (err) {
      console.error('[support] Embedding feedback:', err);
    }

    const { error: fbErr } = await admin.from('ai_learning_feedback').upsert(
      {
        source_ticket_id:     ticketId,
        error_pattern:        fb.error_pattern,
        root_mistake:         fb.root_mistake,
        correct_approach:     fb.correct_approach,
        prevented_recurrence: false,
        feedback_embedding:   fbEmbedding,
      },
      { onConflict: 'source_ticket_id' }
    );

    if (fbErr) {
      console.error('[support] Upsert ai_learning_feedback:', fbErr.message);
    } else {
      console.info('[support] Mémoire négative enregistrée pour ticket', ticketId);
    }
  }
}

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    if (!ticket) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
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
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { status?: string; title?: string };

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
      if (!ticket) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
      return NextResponse.json({ ticket });
    }

    // ── Changement de statut ────────────────────────────────────────────────
    const nextStatus = body.status;
    if (nextStatus !== 'archived' && nextStatus !== 'open') {
      return NextResponse.json({ error: 'status ou title requis' }, { status: 400 });
    }

    const { data: before } = await supabase
      .from('tickets')
      .select('status')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!before) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

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
      try {
        await persistLearningOnArchive(id, user.id);
      } catch (learnErr) {
        console.error('[support] Apprentissage archivage:', learnErr);
      }
    }

    return NextResponse.json({ ticket });
  } catch (e) {
    console.error('[api/support/tickets/[id] PATCH]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur' },
      { status: 500 }
    );
  }
}
