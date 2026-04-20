import { NextRequest, NextResponse } from 'next/server';
import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { dateFnsLocaleForApp } from '@/lib/i18n/date-fns-locale';
import {
  buildDailyActivityRowsForDateRange,
  buildWeeklySummaryForRange,
  type LoyaltyEventRow,
} from '@/lib/banano/pilotage/build-pilotage-dashboard';

const MAX_RANGE_DAYS = 400;

function parseYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parseISO(`${s}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET …/daily-activity?month=2026-03 | ?from=YYYY-MM-DD&to=YYYY-MM-DD
 * &granularity=day|week
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const locale = apiLocaleFromRequest(request);
  const tDaily = createServerTranslator('Dashboard.bananoPilotageDailyApi', locale);
  const dfLoc = dateFnsLocaleForApp(locale);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const sp = request.nextUrl.searchParams;
  const monthRaw = sp.get('month')?.trim();
  const fromRaw = sp.get('from')?.trim();
  const toRaw = sp.get('to')?.trim();
  const granularity = sp.get('granularity') === 'week' ? 'week' : 'day';

  let rangeStart: Date;
  let rangeEnd: Date;
  let periodLabelFr: string;

  if (monthRaw && /^\d{4}-\d{2}$/.test(monthRaw)) {
    const [y, m] = monthRaw.split('-').map(Number);
    rangeStart = startOfMonth(new Date(y, m - 1, 1));
    rangeEnd = endOfMonth(new Date(y, m - 1, 1));
    const labelRaw = format(rangeStart, 'MMMM yyyy', { locale: dfLoc });
    periodLabelFr = labelRaw.charAt(0).toUpperCase() + labelRaw.slice(1);
  } else if (fromRaw && toRaw) {
    const a = parseYmd(fromRaw);
    const b = parseYmd(toRaw);
    if (!a || !b) {
      return NextResponse.json({ error: tDaily('invalidFromTo') }, { status: 400 });
    }
    rangeStart = startOfDay(a <= b ? a : b);
    rangeEnd = startOfDay(b >= a ? b : a);
    periodLabelFr = tDaily('periodFromTo', {
      from: format(rangeStart, 'd MMM yyyy', { locale: dfLoc }),
      to: format(rangeEnd, 'd MMM yyyy', { locale: dfLoc }),
    });
  } else {
    return NextResponse.json({ error: tDaily('monthOrRangeRequired') }, { status: 400 });
  }

  const dayCount = eachDayOfInterval({ start: rangeStart, end: rangeEnd }).length;
  if (dayCount > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: tDaily('rangeTooLarge', { max: MAX_RANGE_DAYS }) }, { status: 400 });
  }

  const fromIso = startOfDay(rangeStart).toISOString();
  const toIso = endOfDay(rangeEnd).toISOString();

  const { data: eventsRaw, error: evErr } = await supabase
    .from('banano_loyalty_events')
    .select('created_at, event_type, member_id, amount_cents, note, items_count')
    .eq('user_id', user.id)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: true })
    .limit(50_000);

  if (evErr) {
    console.error('[banano/pilotage/daily-activity]', evErr.message);
    return NextResponse.json({ error: tDaily('readError') }, { status: 500 });
  }

  const events = (eventsRaw ?? []) as LoyaltyEventRow[];
  const visitRows = events.filter(
    (e) => e.event_type === 'earn_points' || e.event_type === 'earn_stamps'
  );

  const fromKey = format(startOfDay(rangeStart), 'yyyy-MM-dd');
  const toKey = format(startOfDay(rangeEnd), 'yyyy-MM-dd');

  if (granularity === 'week') {
    const weekly = buildWeeklySummaryForRange(visitRows, rangeStart, rangeEnd);
    return NextResponse.json({
      granularity: 'week' as const,
      periodLabelFr,
      from: fromKey,
      to: toKey,
      weekly,
    });
  }

  const daily = buildDailyActivityRowsForDateRange(visitRows, rangeStart, rangeEnd);
  return NextResponse.json({
    granularity: 'day' as const,
    periodLabelFr,
    from: fromKey,
    to: toKey,
    daily,
  });
}
