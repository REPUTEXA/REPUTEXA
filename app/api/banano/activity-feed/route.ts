import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isUuid, orKeysetDesc2, parseCursorIso } from '@/lib/supabase/keyset-predicates';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatTerminalClientName } from '@/lib/banano/terminal-client-name-format';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

function fmtLineDate(iso: string): string {
  try {
    const d = new Date(iso);
    const day = format(d, 'd', { locale: fr });
    const mon = format(d, 'LLLL', { locale: fr });
    const year = format(d, 'yyyy', { locale: fr });
    const hm = format(d, 'HH:mm', { locale: fr });
    const monCap = mon.charAt(0).toUpperCase() + mon.slice(1);
    return `${day} ${monCap} ${year} · ${hm}`;
  } catch {
    return iso;
  }
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

export async function GET(req: Request) {
  const tb = createServerTranslator('ApiBanano', apiLocaleFromRequest(req));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const limitRaw = new URL(req.url).searchParams.get('limit');
  const limit = Math.min(120, Math.max(5, parseInt(limitRaw ?? '20', 10) || 20));
  const fetchLimit = limit + 1;

  const { searchParams } = new URL(req.url);
  const afterAtRaw = searchParams.get('afterCreatedAt');
  const afterIdRaw = searchParams.get('afterId');
  let keysetOr: string | null = null;
  if (afterAtRaw != null && afterIdRaw != null) {
    const ca = parseCursorIso(afterAtRaw);
    const id = afterIdRaw.trim();
    if (ca !== null && isUuid(id)) {
      keysetOr = orKeysetDesc2('created_at', ca, id);
    }
  }

  const countRes = await supabase
    .from('banano_loyalty_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (countRes.error) {
    console.error('[banano/activity-feed count]', countRes.error.message);
    return NextResponse.json({ error: tb('activityFeedHistoryFailed') }, { status: 500 });
  }

  const total = countRes.count ?? 0;

  let evQuery = supabase
    .from('banano_loyalty_events')
    .select(
      'id, event_type, delta_points, delta_stamps, created_at, staff_id, member_id, amount_cents'
    )
    .eq('user_id', user.id);

  if (keysetOr) {
    evQuery = evQuery.or(keysetOr);
  }

  const { data: events, error: evErr } = await evQuery
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit);

  if (evErr) {
    console.error('[banano/activity-feed events]', evErr.message);
    return NextResponse.json({ error: tb('activityFeedHistoryFailed') }, { status: 500 });
  }

  const rawEv = events ?? [];
  const hasMoreEv = rawEv.length > limit;
  const evList = hasMoreEv ? rawEv.slice(0, limit) : rawEv;
  const tailEv = evList.length > 0 ? evList[evList.length - 1] : null;
  const nextCursor =
    hasMoreEv && tailEv
      ? {
          created_at: (tailEv as { created_at: string }).created_at,
          id: (tailEv as { id: string }).id,
        }
      : null;
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
    const { data: mems, error: mErr } = await supabase
      .from('banano_loyalty_members')
      .select('id, display_name, first_name, last_name')
      .eq('user_id', user.id)
      .in('id', memberIds);
    if (mErr) {
      console.error('[banano/activity-feed members]', mErr.message);
      return NextResponse.json({ error: tb('activityFeedMembersFailed') }, { status: 500 });
    }
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
    const { data: stf, error: sErr } = await supabase
      .from('banano_terminal_staff')
      .select('id, display_name')
      .eq('user_id', user.id)
      .in('id', staffIds);
    if (sErr) {
      console.error('[banano/activity-feed staff]', sErr.message);
    } else {
      for (const s of stf ?? []) {
        staffMap.set((s as { id: string }).id, (s as { display_name: string }).display_name);
      }
    }
  }

  const items: { at: string; line: string }[] = [];

  for (const raw of evList) {
    const ev = raw as {
      id: string;
      event_type: string;
      delta_points: number;
      delta_stamps: number;
      created_at: string;
      staff_id: string | null;
      member_id: string;
    };
    const staffName = ev.staff_id ? (staffMap.get(ev.staff_id) ?? null) : null;
    const parStaff = staffName ? ` — Par ${staffName}` : '';
    const encSuffix = staffName ? ` — Encaissé par ${staffName}` : '';

    const when = fmtLineDate(ev.created_at);
    const mem = memberMap.get(ev.member_id);
    const clientName = mem ? memberLabel(mem) : 'Client';

    if (ev.event_type === 'member_created') {
      items.push({
        at: ev.created_at,
        line: `${when} : Nouveau client créé : ${clientName}${parStaff}`,
      });
      continue;
    }

    if (ev.event_type === 'earn_points') {
      const pts = ev.delta_points;
      items.push({
        at: ev.created_at,
        line: `${when} : ${clientName} (+${pts} pt${pts > 1 ? 's' : ''})${encSuffix}`,
      });
      continue;
    }

    if (ev.event_type === 'earn_stamps') {
      const st = ev.delta_stamps;
      items.push({
        at: ev.created_at,
        line: `${when} : ${clientName} (+${st} tampon${st > 1 ? 's' : ''})${encSuffix}`,
      });
      continue;
    }

    if (ev.event_type === 'encaisser_reward') {
      items.push({
        at: ev.created_at,
        line: `${when} : ${clientName} — Récompense fidélité utilisée${parStaff}`,
      });
      continue;
    }

    if (ev.event_type === 'redeem_points') {
      items.push({
        at: ev.created_at,
        line: `${when} : ${clientName} — ${Math.abs(ev.delta_points)} pt utilisé${Math.abs(ev.delta_points) > 1 ? 's' : ''}${parStaff}`,
      });
      continue;
    }

    if (ev.event_type === 'redeem_stamps') {
      items.push({
        at: ev.created_at,
        line: `${when} : ${clientName} — Tampons débités${parStaff}`,
      });
      continue;
    }

    if (ev.event_type === 'voucher_issued') {
      const pts = ev.delta_points;
      items.push({
        at: ev.created_at,
        line: `${when} : ${clientName} — Bon fidélité émis (${pts} pt seuil)${parStaff}`,
      });
      continue;
    }

    if (ev.event_type === 'voucher_redeemed') {
      items.push({
        at: ev.created_at,
        line: `${when} : ${clientName} — Bon validé en caisse${parStaff}`,
      });
      continue;
    }

    items.push({
      at: ev.created_at,
      line: `${when} : ${clientName} — Activité fidélité${parStaff}`,
    });
  }

  return NextResponse.json({
    items,
    total,
    limit,
    nextCursor,
  });
}
