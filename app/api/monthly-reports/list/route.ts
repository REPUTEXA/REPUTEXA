/**
 * Liste paginée des rapports mensuels + filtre mois/année/recherche.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const locale = apiLocaleFromRequest(request);
  const intlTag = siteLocaleToIntlDateTag(locale);
  const monthLabel = (m: number) =>
    new Date(2000, m - 1, 1).toLocaleDateString(intlTag, { month: 'long' });

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(24, Math.max(4, parseInt(searchParams.get('pageSize') || '10', 10) || 10));
    const yearFilter = searchParams.get('year');
    const monthFilter = searchParams.get('month');
    const q = (searchParams.get('q') || '').trim().toLowerCase();

    let query = supabase
      .from('monthly_reports')
      .select('id, month, year, report_type, pdf_url, summary_stats, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (yearFilter && /^\d{4}$/.test(yearFilter)) {
      query = query.eq('year', parseInt(yearFilter, 10));
    }
    if (monthFilter && /^\d{1,2}$/.test(monthFilter)) {
      query = query.eq('month', parseInt(monthFilter, 10));
    }

    if (q) {
      const { data: allRows, error } = await query.limit(400);
      if (error) {
        console.error('[monthly-reports/list]', error);
        return apiJsonError(request, 'errors.monthly_listFailed', 500);
      }
      const filtered = (allRows ?? []).filter((r) => {
        const y = r.year as number;
        const m = r.month as number;
        const label = `${monthLabel(m)} ${y}`.toLowerCase();
        return (
          String(y).includes(q) ||
          label.includes(q) ||
          `${m}/${y}`.includes(q) ||
          `${String(m).padStart(2, '0')}/${y}`.includes(q)
        );
      });
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const paged = filtered.slice(start, start + pageSize);
      return NextResponse.json({
        reports: paged.map(mapPublicReport),
        total,
        page,
        pageSize,
      });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: pageRows, error: pageErr, count } = await query.range(from, to);
    if (pageErr) {
      console.error('[monthly-reports/list]', pageErr);
      return apiJsonError(request, 'errors.monthly_listFailed', 500);
    }

    const rows = pageRows ?? [];

    return NextResponse.json({
      reports: rows.map(mapPublicReport),
      total: count ?? rows.length,
      page,
      pageSize,
    });
  } catch (e) {
    console.error('[monthly-reports/list]', e);
    return apiJsonError(request, 'errors.monthly_listFailed', 500);
  }
}

/** Ne pas exposer de lien signé (expire après 1 h). Le client utilise `/api/monthly-reports/download`. */
function mapPublicReport(r: {
  id: string;
  month: number;
  year: number;
  report_type: string;
  pdf_url: string | null;
  summary_stats: unknown;
  created_at: string;
}) {
  return {
    id: r.id,
    month: r.month,
    year: r.year,
    report_type: r.report_type,
    pdf_ready: Boolean(r.pdf_url),
    summary_stats: r.summary_stats,
    created_at: r.created_at,
  };
}
