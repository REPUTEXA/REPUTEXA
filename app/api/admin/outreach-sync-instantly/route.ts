import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { pushProspectsToInstantlyForCountry } from '@/lib/outreach/outreach-integrator';
import { isGrowthSchemaAvailable } from '@/lib/growth/prisma-growth-ready';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  countryCode: z.string().min(2).max(4).transform((s) => s.toUpperCase()),
  limit: z.number().int().min(1).max(1000).optional(),
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

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const ta = apiAdminT();
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: ta('payloadInvalid'), details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (!isGrowthSchemaAvailable()) {
    return NextResponse.json({ error: ta('prismaClientStale') }, { status: 503 });
  }

  try {
    const result = await pushProspectsToInstantlyForCountry(
      parsed.data.countryCode,
      parsed.data.limit
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error('[outreach-sync-instantly]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('outreachSyncInstantlyFailed') },
      { status: 400 }
    );
  }
}
