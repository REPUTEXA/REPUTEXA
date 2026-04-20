import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractLearningFromTranscript } from '@/lib/support/learning-extraction';
import type { ExtractedLearning } from '@/lib/support/learning-extraction';
import { embedText } from '@/lib/support/embeddings';
import { toVectorParam } from '@/lib/support/vector';

async function enqueueDevBacklogEntry(
  admin: SupabaseClient,
  ticketId: string,
  extracted: ExtractedLearning
) {
  const { data: dup } = await admin.from('dev_backlog').select('id').eq('source_ticket_id', ticketId).maybeSingle();
  if (dup) return;

  const rawTitle = extracted.root_cause.split(/[.!\n]/)[0]?.trim() || 'Support — analyse ticket';
  const title = rawTitle.slice(0, 200);
  const technical_summary = [extracted.root_cause, extracted.prevention].filter(Boolean).join('\n\n').slice(0, 8000);
  const suggested_fix = extracted.effective_solution.slice(0, 8000);

  let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  if (extracted.feedback) severity = 'high';
  else if (extracted.gold_standard_score <= 4) severity = 'high';
  else if (extracted.gold_standard_score >= 8) severity = 'low';

  const { error } = await admin.from('dev_backlog').insert({
    source_ticket_id: ticketId,
    title,
    technical_summary,
    suggested_fix,
    file_path: extracted.tool_used,
    severity,
    status: 'open',
  });

  if (error) {
    const code = 'code' in error ? String((error as { code: unknown }).code) : '';
    if (code === '42P01') return;
    console.error('[support] dev_backlog insert:', error.message);
  }
}

async function upsertSupportVerdictRow(
  admin: SupabaseClient,
  ticketId: string,
  summaryClean: string,
  technicalFix: string,
  tags: string[],
  embeddingLiteral: string | null
) {
  const { error: verdictErr } = await admin.from('support_verdicts').upsert(
    {
      ticket_id: ticketId,
      summary_clean: summaryClean.slice(0, 6000),
      technical_fix: technicalFix.slice(0, 12000),
      tags,
      embedding: embeddingLiteral,
    },
    { onConflict: 'ticket_id' }
  );
  if (verdictErr) {
    const code = 'code' in verdictErr ? String((verdictErr as { code: unknown }).code) : '';
    if (code !== '42P01') {
      console.error('[support] Upsert support_verdicts:', verdictErr.message);
    }
  }
}

/**
 * Archivage — apprentissage (RAG, mémoire dynamique, feedback).
 * Si humanVerdict est fourni, alimente support_verdicts + embedding à partir des textes humains
 * (complète ou remplace l’extrait auto pour ce ticket).
 */
export async function persistLearningOnArchive(
  ticketId: string,
  userId: string,
  opts?: { humanVerdict?: { problem: string; solution: string } }
): Promise<void> {
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

  const hv = opts?.humanVerdict;
  const humanOk = Boolean(hv?.problem?.trim() && hv?.solution?.trim());

  if (messages.length === 0) {
    if (humanOk && hv) {
      let emb: string | null = null;
      try {
        const vec = await embedText(`${hv.problem.trim()}\n\n${hv.solution.trim()}`);
        emb = toVectorParam(vec);
      } catch (err) {
        console.error('[support] Embedding verdict humain (ticket vide):', err);
      }
      await upsertSupportVerdictRow(
        admin,
        ticketId,
        hv.problem.trim(),
        hv.solution.trim(),
        ['nexus_verdict', 'human_verdict'],
        emb
      );
    }
    return;
  }

  const extracted = await extractLearningFromTranscript(messages);
  const isGold = extracted.gold_standard_score >= 8;

  const summaryText = [extracted.root_cause, extracted.effective_solution, extracted.prevention].join('\n\n');

  let embeddingLiteral: string | null = null;
  try {
    const vec = await embedText(summaryText);
    embeddingLiteral = toVectorParam(vec);
  } catch (err) {
    console.error('[support] Embedding apprentissage:', err);
  }

  const knowledgePayload = {
    source_ticket_id: ticketId,
    root_cause: extracted.root_cause,
    effective_solution: extracted.effective_solution,
    prevention: extracted.prevention,
    summary_embedding: embeddingLiteral,
    is_gold_standard: isGold,
    gold_standard_score: extracted.gold_standard_score,
    tool_used: extracted.tool_used ?? null,
  };

  const { error: knowledgeErr } = await admin.from('ai_learning_knowledge').upsert(knowledgePayload, {
    onConflict: 'source_ticket_id',
  });

  if (knowledgeErr) {
    console.error('[support] Upsert ai_learning_knowledge:', knowledgeErr.message);
    throw knowledgeErr;
  }

  if (humanOk && hv) {
    let verdictEmbed: string | null = null;
    try {
      const vec = await embedText(`${hv.problem.trim()}\n\n${hv.solution.trim()}`);
      verdictEmbed = toVectorParam(vec);
    } catch (err) {
      console.error('[support] Embedding verdict humain:', err);
      verdictEmbed = embeddingLiteral;
    }
    const tags = [
      'nexus_verdict',
      'human_verdict',
      ...(isGold ? ['gold_standard'] : []),
      ...(extracted.tool_used ? [`tool:${String(extracted.tool_used).slice(0, 80)}`] : []),
    ];
    await upsertSupportVerdictRow(
      admin,
      ticketId,
      hv.problem.trim(),
      hv.solution.trim(),
      tags,
      verdictEmbed
    );
  } else {
    const verdictTags = [
      'nexus_verdict',
      ...(isGold ? ['gold_standard'] : []),
      ...(extracted.tool_used ? [`tool:${String(extracted.tool_used).slice(0, 80)}`] : []),
    ];
    await upsertSupportVerdictRow(
      admin,
      ticketId,
      extracted.root_cause.slice(0, 6000),
      extracted.effective_solution.slice(0, 12000),
      verdictTags,
      embeddingLiteral
    );
  }

  if (isGold) {
    console.info(`[support] GOLD STANDARD (score ${extracted.gold_standard_score}/10) enregistré pour ticket ${ticketId}`);
  } else {
    console.info(`[support] Apprentissage enregistré (score ${extracted.gold_standard_score}/10) pour ticket ${ticketId}`);
  }

  const dynamicText = [
    `Problème (type) :\n${extracted.root_cause}`,
    `Solution :\n${extracted.effective_solution}`,
  ].join('\n\n');
  let dynamicEmbedding: string | null = null;
  try {
    const vec = await embedText(dynamicText);
    dynamicEmbedding = toVectorParam(vec);
  } catch (err) {
    console.error('[support] Embedding knowledge_base_dynamic:', err);
  }

  const { error: dynamicErr } = await admin.from('knowledge_base_dynamic').upsert(
    {
      source_ticket_id: ticketId,
      problem_summary: extracted.root_cause.slice(0, 6000),
      solution_summary: extracted.effective_solution.slice(0, 6000),
      embedding: dynamicEmbedding,
    },
    { onConflict: 'source_ticket_id' }
  );
  if (dynamicErr) {
    const code = 'code' in dynamicErr ? String((dynamicErr as { code: unknown }).code) : '';
    if (code !== '42P01') {
      console.error('[support] Upsert knowledge_base_dynamic:', dynamicErr.message);
    }
  }

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
        source_ticket_id: ticketId,
        error_pattern: fb.error_pattern,
        root_mistake: fb.root_mistake,
        correct_approach: fb.correct_approach,
        prevented_recurrence: false,
        feedback_embedding: fbEmbedding,
      },
      { onConflict: 'source_ticket_id' }
    );

    if (fbErr) {
      console.error('[support] Upsert ai_learning_feedback:', fbErr.message);
    } else {
      console.info('[support] Mémoire négative enregistrée pour ticket', ticketId);
    }
  }

  try {
    await enqueueDevBacklogEntry(admin, ticketId, extracted);
  } catch (e) {
    console.warn('[support] dev_backlog:', e instanceof Error ? e.message : e);
  }
}
