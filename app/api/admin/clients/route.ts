/**
 * GET /api/admin/clients
 * Paginated list sorted by exception handling: priority_score DESC, created_at DESC.
 * Optional filter priority=100|50|0 + 7-day sparkline (ai_llm_usage_daily).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isUuid,
  orKeysetDescPriorityCreated,
  parseCursorIso,
} from '@/lib/supabase/keyset-predicates';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

const DEFAULT_PER_PAGE = 40;
const MAX_PER_PAGE = 120;

function buildIlikeQuotedFilter(raw: string): string {
  const inner = raw.trim().replace(/"/g, '').replace(/,/g, ' ').slice(0, 120);
  const pattern = `%${inner}%`;
  return `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function utcDateKeysLast7(): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function seriesForUser(
  userId: string,
  rows: { user_id: string; usage_date: string; call_total: number }[],
  dayKeys: string[]
): number[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.user_id !== userId) continue;
    const key =
      typeof r.usage_date === 'string' ? r.usage_date.slice(0, 10) : String(r.usage_date).slice(0, 10);
    map.set(key, r.call_total);
  }
  return dayKeys.map((k) => map.get(k) ?? 0);
}

function validPriorityFilter(v: string | null): v is '100' | '50' | '0' {
  return v === '100' || v === '50' || v === '0';
}

export async function GET(req: NextRequest) {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  let perPage = parseInt(searchParams.get('perPage') ?? String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE;
  perPage = Math.min(Math.max(10, perPage), MAX_PER_PAGE);
  const fetchLimit = perPage + 1;

  const qRaw = searchParams.get('q') ?? '';
  const searchActive = qRaw.trim().length > 0;
  const qQuoted = buildIlikeQuotedFilter(qRaw);
  const priorityParam = searchParams.get('priority');
  const priorityFilter = validPriorityFilter(priorityParam) ? priorityParam : null;

  const afterPriorityRaw = searchParams.get('afterPriority');
  const afterCreatedRaw = searchParams.get('afterCreatedAt');
  const afterIdRaw = searchParams.get('afterId');
  let keysetOr: string | null = null;
  if (afterPriorityRaw != null && afterCreatedRaw != null && afterIdRaw != null) {
    const ps = parseInt(afterPriorityRaw, 10);
    const ca = parseCursorIso(afterCreatedRaw);
    const id = afterIdRaw.trim();
    if (
      (ps === 0 || ps === 50 || ps === 100) &&
      ca !== null &&
      isUuid(id)
    ) {
      keysetOr = orKeysetDescPriorityCreated(ps, ca, id);
    }
  }

  const selectCols =
    'id, full_name, establishment_name, email, phone, locale, subscription_plan, subscription_status, created_at, role, priority_score, last_priority_update, security_alert';

  let countQuery = admin.from('profiles').select('id', { count: 'exact', head: true });
  if (priorityFilter !== null) {
    countQuery = countQuery.eq('priority_score', parseInt(priorityFilter, 10));
  }
  const searchOrInner = searchActive
    ? `establishment_name.ilike.${qQuoted},full_name.ilike.${qQuoted},email.ilike.${qQuoted},phone.ilike.${qQuoted}`
    : null;

  if (searchOrInner) {
    countQuery = countQuery.or(searchOrInner);
  }
  const { count: totalCount, error: countErr } = await countQuery;
  if (countErr) {
    console.error('[admin/clients count]', countErr);
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  let query = admin.from('profiles').select(selectCols);

  if (priorityFilter !== null) {
    query = query.eq('priority_score', parseInt(priorityFilter, 10));
  }

  if (searchOrInner && keysetOr) {
    query = query.or(`and(or(${searchOrInner}),or(${keysetOr}))`);
  } else if (searchOrInner) {
    query = query.or(searchOrInner);
  } else if (keysetOr) {
    query = query.or(keysetOr);
  }

  query = query
    .order('priority_score', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit);

  const { data: rows, error } = await query;

  if (error) {
    console.error('[admin/clients]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = totalCount ?? 0;
  const rawList = rows ?? [];
  const hasMore = rawList.length > perPage;
  const list = hasMore ? rawList.slice(0, perPage) : rawList;
  const last = list.length > 0 ? list[list.length - 1] : null;
  const nextCursor =
    hasMore && last
      ? {
          priority_score: last.priority_score as number,
          created_at:
            typeof last.created_at === 'string'
              ? last.created_at
              : (last.created_at as Date | null)?.toISOString?.() ?? '',
          id: last.id as string,
        }
      : null;
  if (nextCursor && !nextCursor.created_at) {
    console.error('[admin/clients] missing created_at on cursor row');
  }
  const ids = list.map((r) => r.id as string);
  const dayKeys = utcDateKeysLast7();
  const since = dayKeys[0] ?? '1970-01-01';

  let dailyRows: { user_id: string; usage_date: string; call_total: number }[] = [];
  if (ids.length > 0) {
    const { data: dr, error: dErr } = await admin
      .from('ai_llm_usage_daily')
      .select('user_id, usage_date, call_total')
      .in('user_id', ids)
      .gte('usage_date', since);
    if (dErr) {
      console.warn('[admin/clients] ai_llm_usage_daily', dErr);
    } else {
      dailyRows = (dr ?? []) as typeof dailyRows;
    }
  }

  const clients = list.map((row) => ({
    ...row,
    usage_series: seriesForUser(row.id as string, dailyRows, dayKeys),
  }));

  const cursorOut =
    nextCursor && nextCursor.created_at
      ? {
          priority_score: nextCursor.priority_score,
          created_at: new Date(nextCursor.created_at).toISOString(),
          id: nextCursor.id,
        }
      : null;

  return NextResponse.json(
    {
      clients,
      total,
      perPage,
      nextCursor: cursorOut,
      priorityFilter: priorityFilter ?? 'all',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store, must-revalidate',
      },
    }
  );
}
