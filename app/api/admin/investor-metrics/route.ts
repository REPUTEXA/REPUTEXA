import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildInvestorMetrics } from '@/lib/admin/investor-metrics';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/investor-metrics — métriques investisseur (Stripe, OpenAI, profils).
 * Réservé aux comptes role=admin. Peut prendre ~5–15 s (Stripe pagination + OpenAI Costs).
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

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: ta('investorMetricsStripeKeyMissing') }, { status: 500 });
  }

  try {
    const payload = await buildInvestorMetrics(admin);
    return NextResponse.json(payload);
  } catch (e) {
    console.error('[admin/investor-metrics]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('investorMetricsBuildFailed') },
      { status: 500 }
    );
  }
}
