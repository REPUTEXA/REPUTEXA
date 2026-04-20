import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { isGrowthSchemaAvailable } from '@/lib/growth/prisma-growth-ready';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

const postSchema = z.object({
  countryCode: z.string().min(2).max(4).transform((s) => s.toUpperCase()),
  hostname: z
    .string()
    .min(3)
    .max(253)
    .transform((s) => s.trim().toLowerCase()),
  status: z.enum(['WARMUP', 'ACTIVE', 'PAUSED', 'QUARANTINE']).optional(),
  notes: z.string().max(500).nullable().optional(),
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

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const ta = apiAdminT();
  const code = (new URL(request.url).searchParams.get('countryCode') ?? '').toUpperCase();
  if (code.length < 2) {
    return NextResponse.json({ error: ta('countryCodeRequired') }, { status: 400 });
  }

  const domains = await prisma.outreachDomain.findMany({
    where: { countryCode: code },
    orderBy: { hostname: 'asc' },
  });
  return NextResponse.json({ domains });
}

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

  if (!isGrowthSchemaAvailable()) {
    return NextResponse.json({ error: ta('prismaClientStale') }, { status: 503 });
  }

  const { countryCode, hostname, status, notes } = parsed.data;

  try {
    const created = await prisma.outreachDomain.create({
      data: {
        hostname,
        countryCode,
        status: status ?? 'WARMUP',
        notes: notes ?? null,
      },
    });
    return NextResponse.json({
      domain: {
        id: created.id,
        hostname: created.hostname,
        countryCode: created.countryCode,
        status: created.status,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : ta('outreachCreateFailed');
    if (msg.includes('Unique')) {
      return NextResponse.json({ error: ta('hostnameTaken') }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
