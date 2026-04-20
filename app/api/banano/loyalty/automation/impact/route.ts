import { NextResponse } from 'next/server';
import { format, startOfMonth } from 'date-fns';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createClient } from '@/lib/supabase/server';
import { dateFnsLocaleForApp } from '@/lib/i18n/date-fns-locale';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

export async function GET(request: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(request));
  const appLoc = normalizeAppLocale(apiLocaleFromRequest(request));
  const dfLocale = dateFnsLocaleForApp(appLoc === 'en-gb' ? 'en' : appLoc);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const { data: row } = await supabase
    .from('banano_loyalty_automation_monthly_stats')
    .select('attributed_revenue_cents, sends_count')
    .eq('user_id', user.id)
    .eq('month_start', monthStart)
    .maybeSingle();

  const cents = Number((row as { attributed_revenue_cents?: number })?.attributed_revenue_cents ?? 0);
  const sends = Number((row as { sends_count?: number })?.sends_count ?? 0);

  return NextResponse.json({
    month_label: format(startOfMonth(new Date()), 'MMMM yyyy', { locale: dfLocale }),
    month_start: monthStart,
    attributed_revenue_eur: cents / 100,
    sends_count: sends,
    disclaimer: tm('loyaltyAutomationImpactDisclaimer'),
  });
}
