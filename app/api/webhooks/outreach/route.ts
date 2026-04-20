import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeOutreachWebhook } from '@/lib/outreach/webhook-normalize';
import { isGrowthSchemaAvailable } from '@/lib/growth/prisma-growth-ready';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

function verifySecret(request: Request, secret: string): boolean {
  const h =
    request.headers.get('x-outreach-secret') ??
    request.headers.get('x-webhook-secret') ??
    request.headers.get('x-instantly-secret');
  if (h === secret) return true;
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ') && auth.slice(7) === secret) return true;
  return false;
}

async function resolveProspect(email: string | null, prospectId: string | null) {
  if (prospectId) {
    const byId = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (byId) return byId;
  }
  if (email) {
    return prisma.prospect.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });
  }
  return null;
}

/**
 * Webhook : Instantly (event_type + lead_email) ou payload normalisé { event, email, prospectId }.
 * Met à jour openedAt / clickedAt / opt-out et append OutreachTouch.
 */
export async function POST(request: Request) {
  const ta = apiAdminT();
  const secret = process.env.OUTREACH_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: ta('outreachWebhookSecretMissing') }, { status: 503 });
  }
  if (!verifySecret(request, secret)) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  if (!isGrowthSchemaAvailable()) {
    return NextResponse.json({ error: ta('prismaClientStale') }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const body = Array.isArray(raw) ? raw[0] : raw;
  const normalized = normalizeOutreachWebhook(body);
  if (!normalized) {
    return NextResponse.json({ error: ta('outreachPayloadUnknown') }, { status: 400 });
  }

  const prospect = await resolveProspect(normalized.email, normalized.prospectId);
  if (!prospect) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'prospect_not_found' });
  }

  const now = new Date();
  const touchMeta = {
    provider: normalized.provider,
    kind: normalized.kind,
  };

  if (normalized.kind === 'open') {
    await prisma.$transaction([
      prisma.prospect.update({
        where: { id: prospect.id },
        data: { openedAt: prospect.openedAt ?? now },
      }),
      prisma.outreachTouch.create({
        data: {
          prospectId: prospect.id,
          channel: 'webhook_email_open',
          subjectOrRef: 'open',
          metadata: touchMeta,
        },
      }),
    ]);
  } else if (normalized.kind === 'click') {
    await prisma.$transaction([
      prisma.prospect.update({
        where: { id: prospect.id },
        data: {
          openedAt: prospect.openedAt ?? now,
          clickedAt: prospect.clickedAt ?? now,
        },
      }),
      prisma.outreachTouch.create({
        data: {
          prospectId: prospect.id,
          channel: 'webhook_email_click',
          subjectOrRef: 'click',
          metadata: touchMeta,
        },
      }),
    ]);
  } else if (normalized.kind === 'opt_out') {
    await prisma.$transaction([
      prisma.prospect.update({
        where: { id: prospect.id },
        data: {
          status: 'OPTED_OUT',
          optedOutAt: now,
        },
      }),
      prisma.outreachTouch.create({
        data: {
          prospectId: prospect.id,
          channel: 'webhook_opt_out',
          subjectOrRef: 'unsubscribe',
          metadata: touchMeta,
        },
      }),
    ]);
  } else if (normalized.kind === 'bounce') {
    await prisma.outreachTouch.create({
      data: {
        prospectId: prospect.id,
        channel: 'webhook_bounce',
        subjectOrRef: 'bounce',
        metadata: touchMeta,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
