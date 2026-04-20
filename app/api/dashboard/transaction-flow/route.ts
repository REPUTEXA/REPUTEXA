import { NextResponse } from 'next/server';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiJsonError } from '@/lib/api/api-error-response';
import { resolveMerchantTimeZone } from '@/lib/datetime/merchant-timezone';
function lastDayOfMonthYm(y: number, m1to12: number): number {
  return new Date(y, m1to12, 0).getDate();
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, timezone, banano_flow_auto_archive_monthly')
    .eq('id', user.id)
    .maybeSingle();

  if ((profile as { role?: string } | null)?.role === 'merchant_staff') {
    return apiJsonError(request, 'forbidden', 403);
  }

  const tz = resolveMerchantTimeZone((profile as { timezone?: string } | null)?.timezone ?? null);
  const autoArchiveMonthly =
    (profile as { banano_flow_auto_archive_monthly?: boolean } | null)?.banano_flow_auto_archive_monthly === true;

  const url = new URL(request.url);
  const summaryMonth = url.searchParams.get('summaryMonth');

  if (summaryMonth && /^\d{4}-\d{2}$/.test(summaryMonth)) {
    const [yy, mm] = summaryMonth.split('-').map((x) => parseInt(x, 10));
    const lastD = lastDayOfMonthYm(yy, mm);
    const monthStart = fromZonedTime(`${summaryMonth}-01T00:00:00`, tz);
    const monthEnd = fromZonedTime(
      `${summaryMonth}-${String(lastD).padStart(2, '0')}T23:59:59.999`,
      tz
    );

    const { data: evs, error: evErr } = await supabase
      .from('banano_loyalty_events')
      .select('created_at, amount_cents')
      .eq('user_id', user.id)
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString());

    if (evErr) {
      console.error('[transaction-flow summary]', evErr.message);
      return apiJsonError(request, 'serverError', 500);
    }

    const byDay = new Map<string, { count: number; amountCentsSum: number }>();
    for (const row of evs ?? []) {
      const r = row as { created_at: string; amount_cents: number | null };
      const dayKey = formatInTimeZone(new Date(r.created_at), tz, 'yyyy-MM-dd');
      const cur = byDay.get(dayKey) ?? { count: 0, amountCentsSum: 0 };
      cur.count += 1;
      if (r.amount_cents != null && Number.isFinite(Number(r.amount_cents))) {
        cur.amountCentsSum += Math.round(Number(r.amount_cents));
      }
      byDay.set(dayKey, cur);
    }

    const days = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({
        day,
        count: v.count,
        amountEuroSum: v.amountCentsSum > 0 ? Math.round(v.amountCentsSum) / 100 : null,
      }));

    const { data: marker } = await supabase
      .from('banano_loyalty_flow_month_markers')
      .select('marked_at')
      .eq('user_id', user.id)
      .eq('month_ym', summaryMonth)
      .maybeSingle();

    const archivedAt =
      marker && typeof (marker as { marked_at?: string }).marked_at === 'string'
        ? (marker as { marked_at: string }).marked_at
        : null;

    return NextResponse.json({
      timeZone: tz,
      month: summaryMonth,
      days,
      archivedAt,
      autoArchiveMonthly,
    });
  }

  const dayParam = url.searchParams.get('day');

  const now = new Date();
  let anchor = now;
  if (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
    anchor = fromZonedTime(`${dayParam}T12:00:00`, tz);
  }

  const ymd = formatInTimeZone(anchor, tz, 'yyyy-MM-dd');
  const dayStart = fromZonedTime(`${ymd}T00:00:00`, tz);
  const dayEnd = fromZonedTime(`${ymd}T23:59:59.999`, tz);

  const { data: events, error: evErr } = await supabase
    .from('banano_loyalty_events')
    .select('id, created_at, event_type, amount_cents, processed_by_user_id')
    .eq('user_id', user.id)
    .gte('created_at', dayStart.toISOString())
    .lte('created_at', dayEnd.toISOString())
    .order('created_at', { ascending: true });

  if (evErr) {
    console.error('[transaction-flow]', evErr.message);
    return apiJsonError(request, 'serverError', 500);
  }

  const { data: teamRows, error: teamErr } = await supabase
    .from('merchant_team_members')
    .select('member_user_id, role, status, last_seen_at')
    .eq('merchant_user_id', user.id)
    .eq('status', 'active');

  if (teamErr) {
    console.error('[transaction-flow team]', teamErr.message);
    return apiJsonError(request, 'serverError', 500);
  }

  const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const staffSlots = (teamRows ?? []).filter((r) => {
    const role = (r as { role: string }).role;
    if (role !== 'staff' && role !== 'manager') return false;
    const seen = (r as { last_seen_at: string | null }).last_seen_at;
    return typeof seen === 'string' && seen >= oneHourAgoIso;
  });
  const activeStaffCount = staffSlots.length;

  const admin = createAdminClient();
  const nameIds = new Set<string>();
  for (const e of events ?? []) {
    const pid = (e as { processed_by_user_id?: string | null }).processed_by_user_id;
    if (pid) nameIds.add(pid);
  }
  const names: Record<string, string> = {};
  if (admin && nameIds.size > 0) {
    const { data: profs } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', [...nameIds]);
    for (const p of profs ?? []) {
      const pr = p as { id: string; full_name: string | null; email: string | null };
      names[pr.id] = (pr.full_name && pr.full_name.trim()) || pr.email || pr.id.slice(0, 8);
    }
  }

  const points = (events ?? []).map((row) => {
    const r = row as {
      id: string;
      created_at: string;
      event_type: string;
      amount_cents: number | null;
      processed_by_user_id: string | null;
    };
    const at = new Date(r.created_at);
    const hh = parseInt(formatInTimeZone(at, tz, 'HH'), 10);
    const mm = parseInt(formatInTimeZone(at, tz, 'mm'), 10);
    const minutesFromMidnight = hh * 60 + mm;
    return {
      id: r.id,
      at: r.created_at,
      minutesFromMidnight,
      amountEuro:
        r.amount_cents != null && Number.isFinite(Number(r.amount_cents))
          ? Math.round(Number(r.amount_cents)) / 100
          : null,
      eventType: r.event_type,
      servedByName: r.processed_by_user_id ? names[r.processed_by_user_id] ?? null : null,
    };
  });

  return NextResponse.json({
    timeZone: tz,
    day: ymd,
    windowStartHour: 8,
    windowEndHour: 23,
    activeStaffCount,
    points,
    autoArchiveMonthly,
  });
}
