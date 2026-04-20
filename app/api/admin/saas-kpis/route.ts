import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildSaasKpisPayload } from '@/lib/admin/saas-kpis';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/saas-kpis — MRR, churn logo, LTV et CPA indicatifs (Stripe + profils).
 * Rafraîchissement volontairement moins fréquent que /api/admin/stats (pas de Stripe à chaque seconde).
 */
export async function GET() {
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
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  try {
    const payload = await buildSaasKpisPayload(admin);
    if (!payload) {
      return NextResponse.json({ error: ta('investorMetricsStripeKeyMissing') }, { status: 503 });
    }
    return NextResponse.json(payload);
  } catch (e) {
    console.error('[admin/saas-kpis]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('investorMetricsBuildFailed') },
      { status: 500 }
    );
  }
}
