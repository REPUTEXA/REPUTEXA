import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { isGrowthSchemaAvailable } from '@/lib/growth/prisma-growth-ready';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import {
  assertAllowedLuxuryMissionProduct,
  getMissionLuxuryProductFromMetadata,
} from '@/lib/partnership/luxury-brands';

export const dynamic = 'force-dynamic';

const postSchema = z.object({
  prospectId: z.string().cuid().optional(),
  establishmentId: z.string().cuid().optional(),
  channel: z.string().min(1).max(64),
  subjectOrRef: z.string().max(500).optional(),
  metadata: z.any().optional(),
  setLastOutreach: z.boolean().optional(),
});

async function requireAdmin() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: ta('unauthorized') }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: ta('forbidden') }, { status: 403 }) };
  return { user };
}

/**
 * POST — journaliser un contact sortant (audit). Optionnellement met à jour lastOutreachAt sur le prospect.
 * À utiliser depuis vos workflows / outils d’envoi conformes, pas comme « spam engine ».
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const ta = apiAdminT();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: ta('payloadInvalid'), details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { prospectId, establishmentId, channel, subjectOrRef, metadata, setLastOutreach } = parsed.data;
  if (!prospectId && !establishmentId) {
    return NextResponse.json({ error: ta('prospectOrEstablishmentRequired') }, { status: 400 });
  }

  if (metadata != null && typeof metadata === 'object') {
    const meta = metadata as Record<string, unknown>;
    const hasLuxuryKey =
      'missionLuxuryProduct' in meta ||
      'luxuryProduct' in meta ||
      'missionProduct' in meta;
    if (hasLuxuryKey) {
      const missionProduct = getMissionLuxuryProductFromMetadata(metadata);
      if (missionProduct == null) {
        return NextResponse.json({ error: ta('luxuryMissionProductInvalid') }, { status: 400 });
      }
      try {
        assertAllowedLuxuryMissionProduct(missionProduct);
      } catch {
        return NextResponse.json({ error: ta('luxuryMissionProductInvalid') }, { status: 400 });
      }
    }
  }

  if (!isGrowthSchemaAvailable()) {
    return NextResponse.json({ error: ta('prismaClientStale') }, { status: 503 });
  }

  try {
    const touch = await prisma.$transaction(async (tx) => {
      const t = await tx.outreachTouch.create({
        data: {
          prospectId: prospectId ?? null,
          establishmentId: establishmentId ?? null,
          channel,
          subjectOrRef: subjectOrRef ?? null,
          ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {}),
        },
      });
      if (setLastOutreach && prospectId) {
        await tx.prospect.update({
          where: { id: prospectId },
          data: { lastOutreachAt: new Date() },
        });
      }
      return t;
    });

    return NextResponse.json({
      id: touch.id,
      createdAt: touch.createdAt.toISOString(),
    });
  } catch (e) {
    console.error('[outreach-touch]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('outreachCreateFailed') },
      { status: 500 }
    );
  }
}
