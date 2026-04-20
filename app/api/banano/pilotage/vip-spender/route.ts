import { NextResponse } from 'next/server';
import { endOfMonth, endOfWeek, format, startOfWeek, subWeeks } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { dateFnsLocaleForApp } from '@/lib/i18n/date-fns-locale';

type WindowParam = 'month' | 'prev_week';

function displayName(
  m: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  },
  memberFallback: string
): string {
  const f = (m.first_name ?? '').trim();
  const l = (m.last_name ?? '').trim();
  if (f || l) return `${f} ${l}`.trim();
  return (m.display_name ?? '').trim() || memberFallback;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const locale = apiLocaleFromRequest(req);
  const tm = createServerTranslator('ApiMerchant', locale);
  const dfLoc = dateFnsLocaleForApp(locale);
  const memberFallback = tm('crmVoucherArchiveMemberFallback');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const w = (new URL(req.url).searchParams.get('window') ?? 'month') as WindowParam;
  const window: WindowParam = w === 'prev_week' ? 'prev_week' : 'month';

  const now = new Date();
  let fromIso: string;
  let toExclusiveIso: string;
  let periodLabelFr: string;

  if (window === 'month') {
    const ms = new Date(now.getFullYear(), now.getMonth(), 1);
    const me = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    fromIso = ms.toISOString();
    toExclusiveIso = me.toISOString();
    const last = endOfMonth(ms);
    periodLabelFr = tm('pilotageVipPeriodCurrentMonth', {
      start: format(ms, 'd MMMM yyyy', { locale: dfLoc }),
      end: format(last, 'd MMMM yyyy', { locale: dfLoc }),
    });
  } else {
    const ref = subWeeks(now, 1);
    const start = startOfWeek(ref, { weekStartsOn: 1 });
    const end = endOfWeek(ref, { weekStartsOn: 1 });
    const endPlus = new Date(end);
    endPlus.setDate(endPlus.getDate() + 1);
    endPlus.setHours(0, 0, 0, 0);
    fromIso = start.toISOString();
    toExclusiveIso = endPlus.toISOString();
    periodLabelFr = tm('pilotageVipPeriodLastWeek', {
      start: format(start, 'd MMM', { locale: dfLoc }),
      end: format(end, 'd MMM yyyy', { locale: dfLoc }),
    });
  }

  const { data: evs, error: evErr } = await supabase
    .from('banano_loyalty_events')
    .select('member_id, amount_cents, event_type')
    .eq('user_id', user.id)
    .in('event_type', ['earn_points', 'earn_stamps'])
    .gte('created_at', fromIso)
    .lt('created_at', toExclusiveIso)
    .limit(50_000);

  if (evErr) {
    console.error('[vip-spender]', evErr.message);
    return NextResponse.json({ error: tm('readFailed') }, { status: 500 });
  }

  const spendByMember = new Map<string, number>();
  const visitsByMember = new Map<string, number>();
  for (const raw of evs ?? []) {
    const e = raw as { member_id: string; amount_cents?: number | null };
    const cents = Math.max(0, Math.floor(Number(e.amount_cents ?? 0)));
    spendByMember.set(e.member_id, (spendByMember.get(e.member_id) ?? 0) + cents);
    visitsByMember.set(e.member_id, (visitsByMember.get(e.member_id) ?? 0) + 1);
  }

  let bestId: string | null = null;
  let bestSpend = -1;
  for (const [mid, cents] of spendByMember) {
    if (cents > bestSpend) {
      bestSpend = cents;
      bestId = mid;
    }
  }

  let basis: 'spend' | 'visits' = 'spend';
  if (!bestId || bestSpend <= 0) {
    bestId = null;
    bestSpend = 0;
    let bestV = 0;
    for (const [mid, vc] of visitsByMember) {
      if (vc > bestV) {
        bestV = vc;
        bestId = mid;
      }
    }
    if (bestId && bestV >= 2) {
      basis = 'visits';
      bestSpend = spendByMember.get(bestId) ?? 0;
    } else {
      return NextResponse.json({
        window,
        periodLabelFr,
        member: null,
        spendCents: 0,
        visits: 0,
        basis: null as 'spend' | 'visits' | null,
      });
    }
  }

  const visits = visitsByMember.get(bestId!) ?? 0;

  const { data: mem, error: mErr } = await supabase
    .from('banano_loyalty_members')
    .select('id, display_name, first_name, last_name, phone_e164')
    .eq('user_id', user.id)
    .eq('id', bestId!)
    .maybeSingle();

  if (mErr || !mem) {
    return NextResponse.json({
      window,
      periodLabelFr,
      member: null,
      spendCents: bestSpend,
      visits,
      basis,
    });
  }

  const m = mem as {
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    phone_e164: string | null;
  };

  return NextResponse.json({
    window,
    periodLabelFr,
    member: {
      id: m.id,
      display_name: displayName(m, memberFallback),
      first_name: m.first_name,
      last_name: m.last_name,
      phone_e164: m.phone_e164?.trim() || null,
    },
    spendCents: bestSpend,
    visits,
    basis,
  });
}
