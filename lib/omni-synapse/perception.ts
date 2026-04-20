import type { SupabaseClient } from '@supabase/supabase-js';
import { embedText } from '@/lib/support/embeddings';
import { toVectorParam } from '@/lib/support/vector';
import type { OmniIngestChannel } from './types';

export type IngestInteractionParams = {
  supabase: SupabaseClient;
  userId: string;
  establishmentId: string | null;
  channel: OmniIngestChannel;
  /** Texte déjà normalisé pour l’embedding (résumé ou brut). */
  canonicalText: string;
  metadata?: Record<string, unknown>;
};

/**
 * Protocole de Perception Unifiée : embedding OpenAI text-embedding-3-small + persistance pgvector.
 */
export async function ingestInteractionMemory(
  params: IngestInteractionParams
): Promise<{ id: string }> {
  const { supabase, userId, establishmentId, channel, canonicalText, metadata = {} } = params;
  const trimmed = canonicalText.trim();
  if (!trimmed) {
    throw new Error('canonicalText vide — rien à vectoriser');
  }

  const embedding = await embedText(trimmed);
  const vectorLiteral = toVectorParam(embedding);

  const { data, error } = await supabase
    .from('omni_interaction_memories')
    .insert({
      user_id: userId,
      establishment_id: establishmentId,
      channel,
      canonical_text: trimmed,
      metadata,
      embedding: vectorLiteral,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'insert omni_interaction_memories a échoué');
  }

  return { id: data.id as string };
}

export type SemanticRecallParams = {
  supabase: SupabaseClient;
  userId: string;
  /** Question ou requête naturelle (« clients mécontents du service mais fans de la terrasse »). */
  query: string;
  matchCount?: number;
};

/**
 * RAG sémantique sur la mémoire unifiée du commerçant.
 */
export async function recallInteractionMemories(
  params: SemanticRecallParams
): Promise<
  Array<{
    id: string;
    channel: OmniIngestChannel;
    canonical_text: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }>
> {
  const { supabase, userId, query, matchCount = 12 } = params;
  const q = query.trim();
  if (!q) return [];

  const embedding = await embedText(q);
  const vectorLiteral = toVectorParam(embedding);

  const { data, error } = await supabase.rpc('match_omni_interaction_memories', {
    query_embedding: vectorLiteral,
    filter_user_id: userId,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    channel: string;
    canonical_text: string;
    metadata: Record<string, unknown> | null;
    similarity: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    channel: r.channel as OmniIngestChannel,
    canonical_text: r.canonical_text,
    metadata: r.metadata ?? {},
    similarity: r.similarity,
  }));
}
