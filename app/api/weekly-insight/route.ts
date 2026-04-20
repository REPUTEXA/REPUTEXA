import { NextRequest, NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { hasFeature, toPlanSlug, FEATURES } from '@/lib/feature-gate';
import { validateEstablishmentId } from '@/lib/validate-establishment';

function formatWeekLabelFr(weekStart: string): string {
  if (!weekStart) return '';
  const d = new Date(weekStart + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return weekStart;
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * GET : weekly insights paginés + recherche (semaine, année).
 * ?establishmentId= · ?page= · ?pageSize= · ?q= · ?year= · ?weekStart= (lundi YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiJsonError(request, 'unauthorized', 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan, selected_plan')
    .eq('id', user.id)
    .single();

  const planSlug = toPlanSlug(profile?.subscription_plan ?? null, profile?.selected_plan ?? null);
  if (!hasFeature(planSlug, FEATURES.REPORTING_WHATSAPP_RECAP)) {
    return NextResponse.json({ insight: null, reports: [], total: 0, page: 1, pageSize: 10 });
  }

  const { searchParams } = request.nextUrl;
  const rawEstablishmentId = searchParams.get('establishmentId')?.trim() || null;
  const establishmentId = await validateEstablishmentId(supabase, rawEstablishmentId ?? 'profile');

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(40, Math.max(4, parseInt(searchParams.get('pageSize') || '8', 10) || 8));
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const yearParam = searchParams.get('year')?.trim() ?? '';
  const yearFilter = /^\d{4}$/.test(yearParam) ? parseInt(yearParam, 10) : null;
  const weekStartParam = searchParams.get('weekStart')?.trim() ?? '';
  const weekStartMonday =
    /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam) ? weekStartParam : null;

  let base = supabase
    .from('weekly_insights')
    .select('id, week_start, establishment_name, establishment_id, avg_rating, total_reviews, top_section, watch_section, advice_section, full_report_json, trend_severity, created_at', {
      count: 'exact',
    })
    .eq('user_id', user.id)
    .order('week_start', { ascending: false });

  if (establishmentId === 'profile') {
    base = base.is('establishment_id', null);
  } else if (establishmentId) {
    base = base.eq('establishment_id', establishmentId);
  }

  if (weekStartMonday) {
    base = base.eq('week_start', weekStartMonday);
  } else if (yearFilter != null) {
    base = base.gte('week_start', `${yearFilter}-01-01`).lte('week_start', `${yearFilter}-12-31`);
  }

  if (q) {
    const { data: allRows, error } = await base.limit(400);
    if (error) return apiJsonError(request, 'serverError', 500);
    const filtered = (allRows ?? []).filter((r) => {
      const ws = String(r.week_start ?? '');
      const pretty = formatWeekLabelFr(ws).toLowerCase();
      return (
        ws.includes(q) ||
        pretty.includes(q) ||
        (q.length >= 4 && ws.startsWith(q.slice(0, 4))) ||
        (q.includes('/') && pretty.includes(q.replace(/\s/g, '')))
      );
    });
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);
    return NextResponse.json({
      insight: paged[0] ?? null,
      reports: paged,
      total,
      page,
      pageSize,
    });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data: pageRows, error: pageErr, count } = await base.range(from, to);
  if (pageErr) return apiJsonError(request, 'serverError', 500);

  const list = pageRows ?? [];
  return NextResponse.json({
    insight: list[0] ?? null,
    reports: list,
    total: count ?? list.length,
    page,
    pageSize,
  });
}
