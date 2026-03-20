/**
 * POST /api/support/tickets/[id]/messages
 *
 * Agent Expert Support — Architecture Génesis v2
 * Boucle agentique Claude 3.5 Sonnet avec :
 *   - Protocole 4 phases : Analyse → Action → Réponse → Apprentissage
 *   - Chain of Thought + Self-Refine intégré au prompt
 *   - Journalisation des outils (tool_call_log)
 *   - Détection Bug de Design (threshold 5 appels / 7 jours → incident)
 *
 * Retour : { message: string, actions: { name, label, success, icon }[] }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchRagContext } from '@/lib/support/rag-context';
import { SUPPORT_SYSTEM_PROMPT } from '@/lib/support/support-prompt';
import {
  SUPPORT_AGENT_TOOLS,
  executeTool,
  TOOL_UI,
  type ToolName,
  type ToolCallResult,
} from '@/lib/support/agent-tools';

export const dynamic   = 'force-dynamic';
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

const AGENT_MODEL  = process.env.ANTHROPIC_AGENT_MODEL ?? 'claude-3-5-sonnet-20241022';
const MAX_LOOPS    = 5;
const BUG_DESIGN_THRESHOLD = 5;   // appels en 7 jours → incident
const BUG_DESIGN_DAYS      = 7;

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  const block = content.find((b) => b.type === 'text');
  return block && 'text' in block ? block.text.trim() : '';
}

function injectUserId(input: Record<string, string>, userId: string): Record<string, string> {
  return input.user_id ? input : { ...input, user_id: userId };
}

// ── Journalisation outil ──────────────────────────────────────────────────────

async function logToolCall(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  ticketId: string,
  toolName: string,
  success: boolean
): Promise<void> {
  if (!admin) return;
  await admin
    .from('tool_call_log')
    .insert({ user_id: userId, ticket_id: ticketId, tool_name: toolName, success })
    .then(({ error }) => {
      if (error) console.warn('[agent] tool_call_log insert:', error.message);
    });
}

// ── Détection Bug de Design ───────────────────────────────────────────────────

async function checkBugDeDesign(
  admin: ReturnType<typeof createAdminClient>,
  toolName: string
): Promise<void> {
  if (!admin) return;

  const { data } = await admin.rpc('count_tool_usage', {
    p_tool_name: toolName,
    p_days:      BUG_DESIGN_DAYS,
  });

  const row = Array.isArray(data) ? (data[0] as { total_calls: number; failure_count: number } | undefined) : null;
  if (!row || Number(row.total_calls) < BUG_DESIGN_THRESHOLD) return;

  // Vérifier si un incident identique existe déjà dans les dernières 24h
  const { data: existing } = await admin
    .from('system_incidents')
    .select('id')
    .eq('service', 'support_design_bug')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1)
    .maybeSingle();

  if (existing) return; // déjà signalé

  await admin
    .from('system_incidents')
    .insert({
      service:   'support_design_bug',
      status:    'degraded',
      message:   `Bug de Design détecté : l'outil "${toolName}" a été appelé ` +
                 `${row.total_calls} fois en ${BUG_DESIGN_DAYS} jours ` +
                 `(${row.failure_count} échecs). ` +
                 `Investiguer la cause racine dans le code source pour éliminer ce besoin récurrent.`,
      auto_fixed: false,
    })
    .then(({ error }) => {
      if (error) console.warn('[agent] bug-de-design incident:', error.message);
      else       console.info(`[agent] Bug de Design créé pour outil "${toolName}" (${row.total_calls} appels)`);
    });
}

// ── Route principale ──────────────────────────────────────────────────────────

export async function POST(request: Request, context: Ctx) {
  try {
    const { id: ticketId } = await context.params;

    // 1. Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Body
    const body = (await request.json().catch(() => ({}))) as { content?: string };
    const content = String(body.content ?? '').trim();
    if (!content) return NextResponse.json({ error: 'Message vide' }, { status: 400 });

    // 3. Vérifier ticket
    const { data: ticket, error: tErr } = await supabase
      .from('tickets')
      .select('id, status')
      .eq('id', ticketId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (tErr) throw tErr;
    if (!ticket) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    if (ticket.status !== 'open') {
      return NextResponse.json(
        { error: 'Ce dossier est archivé. Ouvrez un nouveau ticket.' },
        { status: 409 }
      );
    }

    // 4. Enregistrer message utilisateur
    const { error: insUserErr } = await supabase
      .from('ticket_messages')
      .insert({ ticket_id: ticketId, sender: 'user', content });
    if (insUserErr) throw insUserErr;

    // 5. Historique
    const { data: history } = await supabase
      .from('ticket_messages')
      .select('sender, content')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    const msgs = (history ?? []).slice(-24);

    // 6. Admin client
    const admin = createAdminClient();

    // 7. RAG v2 (legal + knowledge + code + feedback + gold standards)
    let ragContext = '';
    if (admin) {
      try {
        const { learningBlock, codeBlock, legalBlock } = await fetchRagContext(admin, content);
        ragContext = [
          '## Documents legaux officiels (PRIORITE 1)', legalBlock,
          '',
          '## Memoire interne Genesis v2 (PRIORITE 2)', learningBlock,
          '',
          '## Code source reference technique (PRIORITE 3)', codeBlock,
        ].join('\n');
      } catch (ragErr) {
        console.error('[agent] RAG:', ragErr);
        ragContext = '## Contexte RAG indisponible\nRepondez avec prudence.';
      }
    }

    // 8. Clé Anthropic
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey?.trim()) {
      return NextResponse.json({ error: 'IA non configuree (ANTHROPIC_API_KEY manquant)' }, { status: 503 });
    }
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // 9. Prompt système : base + user_id injecté + RAG
    const systemPrompt =
      `${SUPPORT_SYSTEM_PROMPT}\n\n` +
      `user_id_du_client_courant : ${user.id}\n\n` +
      `---\n${ragContext}`;

    // 10. Historique conversation Anthropic
    const conversation: Anthropic.Messages.MessageParam[] = msgs.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: String(m.content),
    }));

    // 11. BOUCLE AGENTIQUE ─────────────────────────────────────────────────────
    const toolsUsed: ToolCallResult[] = [];
    let iteration = 0;
    let finalText = '';

    while (iteration < MAX_LOOPS) {
      iteration++;

      const response = await anthropic.messages.create({
        model:      AGENT_MODEL,
        max_tokens: 2000,
        temperature: 0.3,
        system:  systemPrompt,
        tools:   SUPPORT_AGENT_TOOLS,
        messages: conversation,
      });

      conversation.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        finalText = extractText(response.content);
        break;
      }

      if (response.stop_reason === 'tool_use') {
        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          const toolName  = block.name as ToolName;
          const toolInput = injectUserId((block.input ?? {}) as Record<string, string>, user.id);

          if (!TOOL_UI[toolName]) {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Outil inconnu : ${toolName}` });
            continue;
          }

          let result: ToolCallResult;
          if (admin) {
            result = await executeTool(admin, toolName, toolInput);
          } else {
            result = {
              tool: toolName,
              label: TOOL_UI[toolName]?.label ?? toolName,
              success: false,
              summary: 'Service admin indisponible (SUPABASE_SERVICE_ROLE_KEY manquant).',
            };
          }

          toolsUsed.push(result);

          // Journalisation asynchrone (non bloquant)
          void logToolCall(admin, user.id, ticketId, toolName, result.success);

          // Détection Bug de Design (non bloquant)
          void checkBugDeDesign(admin, toolName);

          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result.summary });
        }

        conversation.push({ role: 'user', content: toolResults });
        continue;
      }

      finalText = extractText(response.content);
      break;
    }

    if (!finalText) {
      finalText =
        'Je rencontre une difficulte technique momentanee. ' +
        'Permettez-moi de reessayer — veuillez reformuler dans un instant.';
    }

    // 12. Enregistrer réponse IA
    const { error: insAiErr } = await supabase
      .from('ticket_messages')
      .insert({ ticket_id: ticketId, sender: 'ai', content: finalText });
    if (insAiErr) throw insAiErr;

    // 13. Retour
    return NextResponse.json({
      message: finalText,
      actions: toolsUsed.map((t) => ({
        name:    t.tool,
        label:   t.label,
        success: t.success,
        icon:    TOOL_UI[t.tool]?.icon ?? '🔧',
      })),
    });
  } catch (e) {
    console.error('[agent/support/messages]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erreur agent' },
      { status: 500 }
    );
  }
}
