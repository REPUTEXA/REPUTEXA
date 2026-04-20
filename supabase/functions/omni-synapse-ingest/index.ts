/**
 * Supabase Edge — Omni-Synapse Protocole Perception (ingestion + vectorisation).
 * Déploiement : supabase functions deploy omni-synapse-ingest --no-verify-jwt
 *
 * Secrets : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 * Header : Authorization: Bearer <INGEST_HMAC_SECRET ou service token>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const INGEST_SECRET = Deno.env.get('OMNI_INGEST_SECRET') ?? '';

const EMBED_MODEL = 'text-embedding-3-small';

type Channel = 'whatsapp' | 'stripe' | 'google' | 'addition' | 'other';

async function embed(text: string): Promise<number[]> {
  const trimmed = text.trim().slice(0, 12000);
  if (!trimmed) return Array(1536).fill(0);
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: trimmed }),
  });
  if (!res.ok) throw new Error(`OpenAI embed ${res.status}`);
  const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const v = data.data?.[0]?.embedding;
  if (!v?.length) throw new Error('empty embedding');
  return v;
}

function toVectorParam(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  if (INGEST_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${INGEST_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (!OPENAI_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing env' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  let body: {
    userId?: string;
    establishmentId?: string | null;
    channel?: string;
    canonicalText?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const userId = body.userId?.trim();
  const channel = body.channel as Channel | undefined;
  const canonicalText = body.canonicalText?.trim() ?? '';

  const allowed: Channel[] = ['whatsapp', 'stripe', 'google', 'addition', 'other'];
  if (!userId || !channel || !allowed.includes(channel) || !canonicalText) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const embedding = await embed(canonicalText);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await admin
      .from('omni_interaction_memories')
      .insert({
        user_id: userId,
        establishment_id: body.establishmentId?.trim() || null,
        channel,
        canonical_text: canonicalText,
        metadata: body.metadata ?? {},
        embedding: toVectorParam(embedding),
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return new Response(JSON.stringify({ id: data?.id }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ingest failed';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
