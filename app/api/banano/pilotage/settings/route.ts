import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

type Body = {
  /** Montant mensuel TTC objectif en euros (ex. 45000) ; null pour effacer */
  monthlyRevenueGoalEur?: number | null;
};

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const locale = apiLocaleFromRequest(req);
  const tm = createServerTranslator('ApiMerchant', locale);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const updatePayload: Record<string, unknown> = {};

  if (body.monthlyRevenueGoalEur !== undefined) {
    if (body.monthlyRevenueGoalEur === null) {
      updatePayload.banano_pilotage_monthly_revenue_goal_cents = null;
    } else {
      const eur = Number(body.monthlyRevenueGoalEur);
      if (!Number.isFinite(eur) || eur < 0 || eur > 10_000_000) {
        return NextResponse.json({ error: tm('pilotageMonthlyRevenueGoalInvalid') }, { status: 400 });
      }
      updatePayload.banano_pilotage_monthly_revenue_goal_cents = Math.round(eur * 100);
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: tm('noUpdateFields') }, { status: 400 });
  }

  const { error } = await supabase.from('profiles').update(updatePayload).eq('id', user.id);

  if (error) {
    console.error('[banano/pilotage/settings]', error.message);
    return NextResponse.json({ error: tm('updateFailed') }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
