import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runAdminCouncilDigestTick } from '@/lib/admin/council-digest-tick';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

/**
 * POST — manually trigger one « agent council » digest row (same logic as cron).
 * Admin only. Useful when the Vercel cron is not wired yet.
 */
export async function POST() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 });
  }

  const r = await runAdminCouncilDigestTick(admin);
  if (!r.ok) {
    return NextResponse.json({ error: r.error ?? ta('councilDigestJournalWriteFailed') }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: r.id });
}
