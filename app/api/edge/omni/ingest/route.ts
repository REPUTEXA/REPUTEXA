import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { ingestInteractionMemory } from '@/lib/omni-synapse';
import type { OmniIngestChannel } from '@/lib/omni-synapse';

export const runtime = 'edge';

const CHANNELS = new Set<string>(['whatsapp', 'stripe', 'google', 'addition', 'other']);

type Body = {
  userId?: string;
  establishmentId?: string | null;
  channel?: string;
  canonicalText?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Protocole Perception — ingress Edge (latence minimale vers pgvector).
 * Authentification : `Authorization: Bearer <CRON_SECRET>` ou même clé que les webhooks métier.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return apiJsonError(request, 'unauthorized', 401);
    }
  }

  const admin = createAdminClient();
  if (!admin) {
    return apiJsonError(request, 'supabaseAdminNotConfigured', 500);
  }

  let raw: Body = {};
  try {
    raw = (await request.json()) as Body;
  } catch {
    return apiJsonError(request, 'invalidJson', 400);
  }

  const userId = raw.userId?.trim();
  const channel = raw.channel?.trim() ?? '';
  const canonicalText = raw.canonicalText?.trim() ?? '';

  if (!userId || !CHANNELS.has(channel) || !canonicalText) {
    return apiJsonError(request, 'errors.nexusTicketContextMissing', 400);
  }

  try {
    const { id } = await ingestInteractionMemory({
      supabase: admin,
      userId,
      establishmentId: raw.establishmentId?.trim() || null,
      channel: channel as OmniIngestChannel,
      canonicalText,
      metadata: raw.metadata ?? {},
    });
    return NextResponse.json({ id });
  } catch (e) {
    console.error('[edge/omni/ingest]', e);
    return apiJsonError(request, 'serverError', 500);
  }
}
