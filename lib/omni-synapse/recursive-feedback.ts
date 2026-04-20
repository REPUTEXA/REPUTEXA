import type { SupabaseClient } from '@supabase/supabase-js';
import { generateText } from '@/lib/ai-service';
import type { PublicationFollowupOutcome } from './types';

const FOLLOWUP_HORIZON_MS = 48 * 60 * 60 * 1000;

export type RegisterFollowupParams = {
  supabase: SupabaseClient;
  userId: string;
  reviewQueueId: string;
  /** Typiquement review_queue.sent_at ou Date.now() si envoi immédiat. */
  sentAt: Date;
};

/**
 * Enfile un contrôle J+48h après envoi réel (review_queue).
 */
export async function registerPublicationFollowup(params: RegisterFollowupParams): Promise<{ id: string }> {
  const { supabase, userId, reviewQueueId, sentAt } = params;
  const dueAt = new Date(sentAt.getTime() + FOLLOWUP_HORIZON_MS).toISOString();

  const { data, error } = await supabase
    .from('omni_publication_followups')
    .upsert(
      {
        user_id: userId,
        review_queue_id: reviewQueueId,
        due_at: dueAt,
        outcome: 'pending',
        processed_at: null,
        failure_analysis: null,
        prompt_delta: null,
      },
      { onConflict: 'review_queue_id' }
    )
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'registerPublicationFollowup failed');
  }
  return { id: data.id as string };
}

export type ProcessFollowupRow = {
  id: string;
  user_id: string;
  review_queue_id: string;
};

/**
 * Détermine si la collecte / publication a réussi (heuristique tant que l’API Google n’est pas branchée).
 */
export function inferOutcomeFromQueueMetadata(metadata: Record<string, unknown> | null): PublicationFollowupOutcome {
  if (!metadata || typeof metadata !== 'object') return 'unknown';
  if (metadata.google_review_confirmed === true) return 'published';
  if (metadata.google_review_confirmed === false) return 'not_published';
  /** Lien « Publier » envoyé au client ; sans preuve GBP → boucle d’apprentissage. */
  if (typeof metadata.publish_link_sent_at === 'string' && metadata.google_review_confirmed !== true) {
    return 'not_published';
  }
  return 'unknown';
}

export type AnalyzeFailureParams = {
  /** Contexte métier lisible par le modèle. */
  establishmentSummary: string;
  queueMetadata: Record<string, unknown> | null;
  priorOutcome: PublicationFollowupOutcome;
};

/**
 * Le « cerveau » propose un fragment à ajouter au prompt système pour les prochaines générations.
 */
export async function analyzeFailureAndProposePromptDelta(
  params: AnalyzeFailureParams
): Promise<{ analysis: Record<string, unknown>; promptDelta: string }> {
  const systemPrompt =
    'Tu es l\'architecte du système de réponse REPUTEXA (Omni-Synapse). ' +
    'Un envoi de sollicitation d\'avis n\'a pas mené à une publication confirmée après 48h. ' +
    'Propose UNE courte directive (2 à 4 phrases max) à ajouter au prompt de génération des prochains messages ' +
    '(sans répéter la charte anti-IA complète). Réponds UNIQUEMENT en JSON : ' +
    '{"hypothesis": string, "promptDelta": string, "riskTags": string[]}';

  const userContent =
    `Établissement : ${params.establishmentSummary}\n` +
    `Outcome détecté : ${params.priorOutcome}\n` +
    `Metadata file d'attente : ${JSON.stringify(params.queueMetadata ?? {}).slice(0, 2000)}`;

  const raw = await generateText({
    systemPrompt,
    userContent,
    temperature: 0.2,
    maxTokens: 500,
  });

  try {
    const parsed = JSON.parse(raw.trim()) as {
      hypothesis?: string;
      promptDelta?: string;
      riskTags?: string[];
    };
    const promptDelta = String(parsed.promptDelta ?? '').trim().slice(0, 1200);
    const analysis = {
      hypothesis: String(parsed.hypothesis ?? ''),
      riskTags: Array.isArray(parsed.riskTags) ? parsed.riskTags : [],
      generatedAt: new Date().toISOString(),
    };
    return { analysis, promptDelta };
  } catch {
    return {
      analysis: { error: 'parse_failed', generatedAt: new Date().toISOString() },
      promptDelta:
        'Renforcer la concision et éviter toute formulation pouvant être filtrée par les plateformes ; varier l’accroche.',
    };
  }
}

/**
 * Concatène le fragment appris au champ `profiles.omni_recursive_prompt_addon` (idempotent par contenu).
 */
export async function mergePromptAddonIntoProfile(params: {
  supabase: SupabaseClient;
  userId: string;
  newFragment: string;
}): Promise<void> {
  const fragment = params.newFragment.trim();
  if (!fragment) return;

  const { data: row, error: readErr } = await params.supabase
    .from('profiles')
    .select('omni_recursive_prompt_addon')
    .eq('id', params.userId)
    .maybeSingle();

  if (readErr) {
    throw new Error(readErr.message);
  }

  const current = String((row as { omni_recursive_prompt_addon?: string } | null)?.omni_recursive_prompt_addon ?? '');
  if (current.includes(fragment)) {
    return;
  }

  const merged = [current.trim(), fragment].filter(Boolean).join('\n\n—\n\n').slice(0, 8000);

  const { error: upErr } = await params.supabase
    .from('profiles')
    .update({ omni_recursive_prompt_addon: merged })
    .eq('id', params.userId);

  if (upErr) {
    throw new Error(upErr.message);
  }
}
