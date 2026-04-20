import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FEATURES, hasFeature, toPlanSlug } from '@/lib/feature-gate';
import { buildComptaBananoMonthlySummary } from '@/lib/banano/compta-banano-monthly';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const tb = createServerTranslator('ApiBanano', apiLocaleFromRequest(request));
  const y = parseInt(request.nextUrl.searchParams.get('year') || '', 10);
  const m = parseInt(request.nextUrl.searchParams.get('month') || '', 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || y < 2020 || y > 2100 || m < 1 || m > 12) {
    return apiJsonError(request, 'errors.monthly_yearMonthRequired', 400);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan, selected_plan')
    .eq('id', user.id)
    .maybeSingle();

  const plan = toPlanSlug(
    profile && (profile as { subscription_plan?: string }).subscription_plan != null
      ? String((profile as { subscription_plan?: string }).subscription_plan)
      : null,
    profile && (profile as { selected_plan?: string }).selected_plan != null
      ? String((profile as { selected_plan?: string }).selected_plan)
      : null
  );

  if (!hasFeature(plan, FEATURES.COMPTA_BANANO_EXPERT)) {
    return NextResponse.json(
      {
        error: tb('comptaZenithExpertRequired'),
        feature: FEATURES.COMPTA_BANANO_EXPERT,
      },
      { status: 403 }
    );
  }

  const built = await buildComptaBananoMonthlySummary(supabase, user.id, y, m);
  if (!built.ok) {
    console.error('[compta/voucher-summary]', built.error);
    return apiJsonError(request, 'serverError', 500);
  }

  return NextResponse.json(built.data);
}
