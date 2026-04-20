import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { fetchBananoStaffMonthStats } from '@/lib/banano/staff-month-stats';

export async function GET(req: Request) {
  const supabase = await createClient();
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const url = new URL(req.url);
  const yRaw = url.searchParams.get('year');
  const mRaw = url.searchParams.get('month');
  const now = new Date();
  let y = now.getFullYear();
  let mo = now.getMonth() + 1;
  if (yRaw != null && /^\d{4}$/.test(yRaw)) {
    const yy = parseInt(yRaw, 10);
    if (yy >= 2018 && yy <= now.getFullYear() + 1) y = yy;
  }
  if (mRaw != null && mRaw.trim() !== '') {
    const mm = parseInt(mRaw, 10);
    if (Number.isFinite(mm) && mm >= 1 && mm <= 12) mo = mm;
  }
  let periodStart = new Date(y, mo - 1, 1);
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (periodStart.getTime() > startThisMonth.getTime()) {
    periodStart = startThisMonth;
    y = now.getFullYear();
    mo = now.getMonth() + 1;
  }

  try {
    const result = await fetchBananoStaffMonthStats(supabase, user.id, periodStart);
    return NextResponse.json({
      year: periodStart.getFullYear(),
      month: periodStart.getMonth() + 1,
      periodLabelFr: result.monthLabel,
      period: { from: result.monthStartIso, toExclusive: result.monthEndExclusiveIso },
      rows: result.rows,
      disclaimer: result.disclaimer,
    });
  } catch (e) {
    console.error('[banano/staff/stats]', e);
    return NextResponse.json({ error: tm('bananoStaffStatsReadFailed') }, { status: 500 });
  }
}
