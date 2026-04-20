/**
 * GET /api/admin/stats
 * Compteurs du panel admin (même logique que la page admin, sans HTML).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  try {
    const [{ count: totalUsers }, { count: totalAiReviews }, { count: totalLegalVersions }] =
      await Promise.all([
        admin.from('profiles').select('id', { head: true, count: 'exact' }),
        admin
          .from('reviews')
          .select('id', { head: true, count: 'exact' })
          .not('ai_response', 'is', null),
        admin.from('legal_versioning').select('id', { head: true, count: 'exact' }),
      ]);

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      totalAiReviews: totalAiReviews ?? 0,
      totalLegalVersions: totalLegalVersions ?? 0,
    });
  } catch (e) {
    console.error('[admin/stats]', e);
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }
}
