import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { isUuid, orKeysetDesc2, parseCursorIso } from '@/lib/supabase/keyset-predicates';
import type { SupabaseClient } from '@supabase/supabase-js';
import { expireDueBananoVouchers } from '@/lib/banano/expire-loyalty-vouchers';

export type CrmMemberFilter = 'all' | 'top_visits' | 'lost30';

const LIMIT_MAX = 100;
const LIMIT_DEFAULT = 18;

async function attachActiveVoucherCounts(
  supabase: SupabaseClient,
  userId: string,
  _loyaltyMode: 'points' | 'stamps',
  members: Array<Record<string, unknown> & { id: string }>
): Promise<Array<Record<string, unknown> & { id: string; active_voucher_count: number }>> {
  if (members.length === 0) return [];
  const ids = members.map((m) => m.id);
  const { data: vrows } = await supabase
    .from('banano_loyalty_vouchers')
    .select('member_id')
    .eq('user_id', userId)
    .eq('status', 'available')
    .in('member_id', ids);

  const counts = new Map<string, number>();
  for (const r of vrows ?? []) {
    const mid = String((r as { member_id: string }).member_id);
    counts.set(mid, (counts.get(mid) ?? 0) + 1);
  }
  return members.map((m) => ({
    ...m,
    active_voucher_count: counts.get(m.id) ?? 0,
  }));
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const { searchParams } = new URL(req.url);
  const filter = (searchParams.get('filter') ?? 'all') as CrmMemberFilter;
  const limit = Math.min(
    LIMIT_MAX,
    Math.max(1, parseInt(searchParams.get('limit') ?? String(LIMIT_DEFAULT), 10) || LIMIT_DEFAULT)
  );
  const fetchLimit = limit + 1;
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);

  const afterUpdatedRaw = searchParams.get('afterUpdatedAt');
  const afterIdRaw = searchParams.get('afterId');
  let keysetOrAll: string | null = null;
  if (afterUpdatedRaw != null && afterIdRaw != null) {
    const ua = parseCursorIso(afterUpdatedRaw);
    const id = afterIdRaw.trim();
    if (ua !== null && isUuid(id)) {
      keysetOrAll = orKeysetDesc2('updated_at', ua, id);
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('banano_loyalty_mode')
    .eq('id', user.id)
    .maybeSingle();

  const loyaltyMode =
    profile && (profile as { banano_loyalty_mode?: string }).banano_loyalty_mode === 'stamps'
      ? 'stamps'
      : 'points';

  await expireDueBananoVouchers(supabase, user.id);

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffIso = cutoff.toISOString();

  if (filter === 'top_visits') {
    const { data, error } = await supabase
      .from('banano_loyalty_members')
      .select('*')
      .eq('user_id', user.id)
      .order('lifetime_visit_count', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[banano/crm members top]', error.message);
      return apiJsonError(req, 'errors.crm_listReadError', 500);
    }

    const withVc = await attachActiveVoucherCounts(supabase, user.id, loyaltyMode, data ?? []);
    return NextResponse.json({
      members: withVc,
      loyaltyMode,
      filter,
      totalHint: withVc.length,
    });
  }

  if (filter === 'lost30') {
    const { data: a, error: e1 } = await supabase
      .from('banano_loyalty_members')
      .select('*')
      .eq('user_id', user.id)
      .not('last_visit_at', 'is', null)
      .lte('last_visit_at', cutoffIso)
      .order('last_visit_at', { ascending: true })
      .limit(80);

    if (e1) {
      console.error('[banano/crm members lost a]', e1.message);
      return apiJsonError(req, 'errors.crm_listReadError', 500);
    }

    const { data: b, error: e2 } = await supabase
      .from('banano_loyalty_members')
      .select('*')
      .eq('user_id', user.id)
      .is('last_visit_at', null)
      .lte('created_at', cutoffIso)
      .order('created_at', { ascending: true })
      .limit(80);

    if (e2) {
      console.error('[banano/crm members lost b]', e2.message);
      return apiJsonError(req, 'errors.crm_listReadError', 500);
    }

    const byId = new Map<string, NonNullable<typeof a>[number]>();
    for (const row of [...(a ?? []), ...(b ?? [])]) {
      byId.set(row.id, row);
    }
    const merged = Array.from(byId.values()).sort((m1, m2) => {
      const t1 = m1.last_visit_at ? new Date(m1.last_visit_at).getTime() : 0;
      const t2 = m2.last_visit_at ? new Date(m2.last_visit_at).getTime() : 0;
      return t1 - t2;
    });

    const slice = merged.slice(offset, offset + limit);
    const withVc = await attachActiveVoucherCounts(supabase, user.id, loyaltyMode, slice);
    return NextResponse.json({
      members: withVc,
      loyaltyMode,
      filter,
      totalHint: merged.length,
    });
  }

  const { count: totalMembers, error: countErr } = await supabase
    .from('banano_loyalty_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (countErr) {
    console.error('[banano/crm members all count]', countErr.message);
    return apiJsonError(req, 'errors.crm_listReadError', 500);
  }

  let listQuery = supabase.from('banano_loyalty_members').select('*').eq('user_id', user.id);

  if (keysetOrAll) {
    listQuery = listQuery.or(keysetOrAll);
  }

  const { data: rows, error } = await listQuery
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit);

  if (error) {
    console.error('[banano/crm members all]', error.message);
    return apiJsonError(req, 'errors.crm_listReadError', 500);
  }

  const rawList = rows ?? [];
  const hasMore = rawList.length > limit;
  const members = hasMore ? rawList.slice(0, limit) : rawList;
  const tail = members.length > 0 ? members[members.length - 1] : null;
  const nextCursor =
    hasMore && tail
      ? {
          updated_at:
            typeof (tail as { updated_at?: string }).updated_at === 'string'
              ? (tail as { updated_at: string }).updated_at
              : new Date(
                  (tail as { updated_at: string | Date }).updated_at as Date
                ).toISOString(),
          id: (tail as { id: string }).id,
        }
      : null;

  const withVc = await attachActiveVoucherCounts(supabase, user.id, loyaltyMode, members);
  return NextResponse.json({
    members: withVc,
    loyaltyMode,
    filter,
    totalHint: totalMembers ?? withVc.length,
    nextCursor,
  });
}
