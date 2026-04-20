import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const y = parseInt(request.nextUrl.searchParams.get('year') || '', 10);
  const m = parseInt(request.nextUrl.searchParams.get('month') || '', 10);
  const locale = apiLocaleFromRequest(request);
  const tm = createServerTranslator('ApiMerchant', locale);

  if (!Number.isFinite(y) || !Number.isFinite(m) || y < 2020 || y > 2100 || m < 1 || m > 12) {
    return NextResponse.json({ error: tm('pilotageReportYearMonthValuesInvalid') }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(request, 'unauthorized', 401);
  }

  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;

  const { data: row, error: rowErr } = await supabase
    .from('banano_pilotage_performance_reports')
    .select('storage_path')
    .eq('user_id', user.id)
    .eq('month_start', monthStart)
    .maybeSingle();

  if (rowErr || !row) {
    return NextResponse.json({ error: tm('pilotagePerformanceReportNotFound') }, { status: 404 });
  }

  const path = String((row as { storage_path?: string }).storage_path ?? '');
  if (!path.includes('/') || !path.endsWith('.pdf')) {
    return NextResponse.json({ error: tm('voucherArchivePathInvalid') }, { status: 500 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: tm('serverConfigurationError') }, { status: 500 });
  }

  const { data: blob, error: dlErr } = await admin.storage
    .from('banano-pilotage-reports')
    .download(path);

  if (dlErr || !blob) {
    console.error('[banano/pilotage/download]', dlErr?.message, path);
    return NextResponse.json({ error: tm('fileNotFound') }, { status: 404 });
  }

  const ab = await blob.arrayBuffer();
  if (ab.byteLength === 0) {
    return NextResponse.json({ error: tm('fileEmpty') }, { status: 404 });
  }

  const filename = `reputexa-performance-${y}-${String(m).padStart(2, '0')}.pdf`;
  return new NextResponse(new Uint8Array(ab), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
