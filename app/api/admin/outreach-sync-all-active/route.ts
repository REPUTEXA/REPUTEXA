import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runOutreachActiveCountriesCron } from '@/lib/outreach/run-outreach-cron';
import { isGrowthSchemaAvailable } from '@/lib/growth/prisma-growth-ready';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

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
 * POST /api/admin/outreach-sync-all-active
 * Même logique que le cron : tous les pays outreach + instantly + campaign ID.
 */
export async function POST() {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  const ta = apiAdminT();
  if (!isGrowthSchemaAvailable()) {
    return NextResponse.json({ error: ta('prismaClientStale') }, { status: 503 });
  }

  try {
    const { ran, results } = await runOutreachActiveCountriesCron();
    return NextResponse.json({ ok: true, ran, results });
  } catch (e) {
    console.error('[outreach-sync-all-active]', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
