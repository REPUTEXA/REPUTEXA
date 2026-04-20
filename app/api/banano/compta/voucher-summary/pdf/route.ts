import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FEATURES, hasFeature, toPlanSlug } from '@/lib/feature-gate';
import { buildComptaBananoMonthlySummary } from '@/lib/banano/compta-banano-monthly';
import { renderComptaBananoPdfBuffer } from '@/lib/banano/compta-banano-pdf';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const locale = apiLocaleFromRequest(request);
  const tb = createServerTranslator('ApiBanano', locale);
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
    .select('subscription_plan, selected_plan, establishment_name')
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
    return NextResponse.json({ error: tb('comptaZenithRequired') }, { status: 403 });
  }

  const establishmentName = String((profile as { establishment_name?: string })?.establishment_name ?? '');

  const built = await buildComptaBananoMonthlySummary(supabase, user.id, y, m);
  if (!built.ok) {
    console.error('[compta/voucher-summary/pdf]', built.error);
    return apiJsonError(request, 'serverError', 500);
  }

  let buffer: Buffer;
  try {
    buffer = await renderComptaBananoPdfBuffer({
      establishmentName,
      payload: built.data,
      locale,
    });
  } catch (e) {
    console.error('[compta/pdf]', e);
    return NextResponse.json({ error: tb('comptaPdfGenerationFailed') }, { status: 500 });
  }

  const filename = `reputexa-expert-comptable-${y}-${String(m).padStart(2, '0')}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
