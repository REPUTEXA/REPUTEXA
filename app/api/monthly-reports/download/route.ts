/**
 * Téléchargement stable dans le temps : pas d’URL signée qui expire.
 * Tant que le PDF est dans le bucket et le compte actif, un clic regénère l’accès (session requise).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiJsonError } from '@/lib/api/api-error-response';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function parseYearMonth(request: NextRequest): { year: number; month: number } | null {
  const y = parseInt(request.nextUrl.searchParams.get('year') || '', 10);
  const m = parseInt(request.nextUrl.searchParams.get('month') || '', 10);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
  if (y < 2020 || y > 2100 || m < 1 || m > 12) return null;
  return { year: y, month: m };
}

export async function GET(request: NextRequest) {
  try {
    const parsed = parseYearMonth(request);
    if (!parsed) {
      return apiJsonError(request, 'errors.monthly_yearMonthRequired', 400);
    }
    const { year, month } = parsed;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return apiJsonError(request, 'unauthorized', 401);

    const { data: row, error: rowErr } = await supabase
      .from('monthly_reports')
      .select('id, pdf_url')
      .eq('user_id', user.id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();

    if (rowErr || !row) {
      return apiJsonError(request, 'errors.monthly_reportNotFound', 404);
    }

    if (!row.pdf_url) {
      return apiJsonError(request, 'errors.monthly_pdfNotReady', 404);
    }

    const admin = createAdminClient();
    if (!admin) {
      return apiJsonError(request, 'serverConfiguration', 500);
    }

    const raw = String(row.pdf_url);
    const path =
      raw &&
      !raw.startsWith('http') &&
      raw.endsWith('.pdf') &&
      raw.includes('/')
        ? raw
        : `${user.id}/${year}-${String(month).padStart(2, '0')}.pdf`;

    const { data: blob, error: dlErr } = await admin.storage.from('monthly-reports').download(path);

    if (dlErr || !blob) {
      console.error('[monthly-reports/download]', dlErr?.message ?? 'empty blob', path);
      return apiJsonError(request, 'errors.monthly_storageFileNotFound', 404);
    }

    const ab = await blob.arrayBuffer();
    if (ab.byteLength === 0) {
      return apiJsonError(request, 'errors.crm_emptyFile', 404);
    }

    const filename = `reputexa-monthly-report-${year}-${String(month).padStart(2, '0')}.pdf`;
    return new NextResponse(new Uint8Array(ab), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[monthly-reports/download]', e);
    return apiJsonError(request, 'errors.monthly_downloadFailed', 500);
  }
}
