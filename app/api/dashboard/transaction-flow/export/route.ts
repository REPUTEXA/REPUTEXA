import { NextResponse } from 'next/server';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { resolveMerchantTimeZone } from '@/lib/datetime/merchant-timezone';
import { createAdminClient } from '@/lib/supabase/admin';
function csvEscape(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

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
    .select('role, timezone')
    .eq('id', user.id)
    .maybeSingle();

  if ((profile as { role?: string } | null)?.role === 'merchant_staff') {
    return apiJsonError(request, 'forbidden', 403);
  }

  const url = new URL(request.url);
  const month = url.searchParams.get('month');
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return apiJsonError(request, 'badRequest', 400);
  }

  const tz = resolveMerchantTimeZone((profile as { timezone?: string } | null)?.timezone ?? null);
  const [yy, mm] = month.split('-').map((x) => parseInt(x, 10));
  const lastD = lastDayOfMonthYm(yy, mm);
  const monthStart = fromZonedTime(`${month}-01T00:00:00`, tz);
  const monthEnd = fromZonedTime(`${month}-${String(lastD).padStart(2, '0')}T23:59:59.999`, tz);

  const { data: rows, error } = await supabase
    .from('banano_loyalty_events')
    .select('id, created_at, event_type, amount_cents, processed_by_user_id')
    .eq('user_id', user.id)
    .gte('created_at', monthStart.toISOString())
    .lte('created_at', monthEnd.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[transaction-flow export]', error.message);
    return apiJsonError(request, 'serverError', 500);
  }

  const nameIds = new Set<string>();
  for (const r of rows ?? []) {
    const pid = (r as { processed_by_user_id?: string | null }).processed_by_user_id;
    if (pid) nameIds.add(pid);
  }
  const names: Record<string, string> = {};
  const admin = createAdminClient();
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

  const header = ['id', 'local_date', 'local_time', 'event_type', 'amount_eur', 'processed_by'].join(',');
  const lines = (rows ?? []).map((raw) => {
    const r = raw as {
      id: string;
      created_at: string;
      event_type: string;
      amount_cents: number | null;
      processed_by_user_id: string | null;
    };
    const at = new Date(r.created_at);
    const localDate = formatInTimeZone(at, tz, 'yyyy-MM-dd');
    const localTime = formatInTimeZone(at, tz, 'HH:mm:ss');
    const eur =
      r.amount_cents != null && Number.isFinite(Number(r.amount_cents))
        ? String(Math.round(Number(r.amount_cents)) / 100)
        : '';
    const by = r.processed_by_user_id ? names[r.processed_by_user_id] ?? '' : '';
    return [
      csvEscape(r.id),
      csvEscape(localDate),
      csvEscape(localTime),
      csvEscape(r.event_type),
      csvEscape(eur),
      csvEscape(by),
    ].join(',');
  });

  const csv = [header, ...lines].join('\n');
  const fname = `reputexa-flux-caisse-${month}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
