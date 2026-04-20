import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { formatTerminalClientName } from '@/lib/banano/terminal-client-name-format';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function memberLabel(m: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const fn = (m.first_name ?? '').trim();
  const ln = (m.last_name ?? '').trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(' ').trim();
  return formatTerminalClientName((m.display_name ?? '').trim()) || 'Client';
}

/** GET : CSV traçabilité pour un mois calendaire (YYYY-MM). Défaut = mois civil précédent. */
export async function GET(req: Request) {
  const tb = createServerTranslator('ApiBanano', apiLocaleFromRequest(req));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const mp = new URL(req.url).searchParams.get('month');
  let y: number;
  let m0: number;
  if (mp && /^\d{4}-\d{2}$/.test(mp)) {
    y = parseInt(mp.slice(0, 4), 10);
    m0 = parseInt(mp.slice(5, 7), 10) - 1;
  } else {
    const n = new Date();
    const prev = new Date(n.getFullYear(), n.getMonth() - 1, 1);
    y = prev.getFullYear();
    m0 = prev.getMonth();
  }
  const fromIso = new Date(y, m0, 1).toISOString();
  const toExclusive = new Date(y, m0 + 1, 1).toISOString();

  const { data: events, error: evErr } = await supabase
    .from('banano_loyalty_events')
    .select('id, event_type, delta_points, delta_stamps, created_at, staff_id, member_id, amount_cents')
    .eq('user_id', user.id)
    .gte('created_at', fromIso)
    .lt('created_at', toExclusive)
    .order('created_at', { ascending: true })
    .limit(25_000);

  if (evErr) {
    console.error('[activity-feed export]', evErr.message);
    return NextResponse.json({ error: tb('activityFeedExportFailed') }, { status: 500 });
  }

  const evList = events ?? [];
  const memberIds = [...new Set(evList.map((e) => (e as { member_id: string }).member_id))];
  const staffIds = [
    ...new Set(
      evList.map((e) => (e as { staff_id: string | null }).staff_id).filter(Boolean) as string[]
    ),
  ];

  const memberMap = new Map<
    string,
    { display_name: string | null; first_name: string | null; last_name: string | null }
  >();
  if (memberIds.length > 0) {
    const { data: mems } = await supabase
      .from('banano_loyalty_members')
      .select('id, display_name, first_name, last_name')
      .eq('user_id', user.id)
      .in('id', memberIds);
    for (const m of mems ?? []) {
      memberMap.set((m as { id: string }).id, {
        display_name: (m as { display_name: string | null }).display_name,
        first_name: (m as { first_name: string | null }).first_name,
        last_name: (m as { last_name: string | null }).last_name,
      });
    }
  }

  const staffMap = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: stf } = await supabase
      .from('banano_terminal_staff')
      .select('id, display_name')
      .eq('user_id', user.id)
      .in('id', staffIds);
    for (const s of stf ?? []) {
      staffMap.set((s as { id: string }).id, (s as { display_name: string }).display_name);
    }
  }

  const lines: string[] = ['date_iso;client;event;detail;equipier'];
  for (const raw of evList) {
    const ev = raw as {
      created_at: string;
      event_type: string;
      delta_points: number;
      delta_stamps: number;
      staff_id: string | null;
      member_id: string;
      amount_cents?: number | null;
    };
    const mem = memberMap.get(ev.member_id);
    const client = mem ? memberLabel(mem) : 'Client';
    const st = ev.staff_id ? staffMap.get(ev.staff_id) ?? '' : '';
    let detail = '';
    switch (ev.event_type) {
      case 'earn_points':
        detail = `+${ev.delta_points} pts;${Math.max(0, Math.floor(Number(ev.amount_cents ?? 0)))} centimes TTC`;
        break;
      case 'earn_stamps':
        detail = `+${ev.delta_stamps} tampons;${Math.max(0, Math.floor(Number(ev.amount_cents ?? 0)))} centimes TTC`;
        break;
      case 'encaisser_reward':
        detail = 'recompense';
        break;
      case 'redeem_points':
        detail = `${Math.abs(ev.delta_points)} pts debit`;
        break;
      case 'member_created':
        detail = 'fiche creee';
        break;
      case 'voucher_issued':
        detail = `bon emis;${ev.delta_points} pts seuil`;
        break;
      case 'voucher_redeemed':
        detail = 'bon valide';
        break;
      default:
        detail = ev.event_type;
    }
    lines.push(
      [
        csvEscape(ev.created_at),
        csvEscape(client),
        csvEscape(ev.event_type),
        csvEscape(detail),
        csvEscape(st),
      ].join(';')
    );
  }

  const csv = lines.join('\n');
  const filename = `reputexa-tracabilite-${y}-${String(m0 + 1).padStart(2, '0')}.csv`;

  return new NextResponse('\uFEFF' + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
