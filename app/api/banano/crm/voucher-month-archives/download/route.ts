import { NextRequest, NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BANANO_VOUCHER_MONTH_ARCHIVE_BUCKET } from '@/lib/banano/run-voucher-month-archive-generation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const y = parseInt(request.nextUrl.searchParams.get('year') || '', 10);
  const m = parseInt(request.nextUrl.searchParams.get('month') || '', 10);
  const kindRaw = request.nextUrl.searchParams.get('kind') ?? 'loyalty';
  const kind =
    kindRaw === 'staff' || kindRaw === 'staff_allowance'
      ? 'staff_allowance'
      : 'loyalty_threshold';

  if (!Number.isFinite(y) || !Number.isFinite(m) || y < 2020 || y > 2100 || m < 1 || m > 12) {
    return apiJsonError(request, 'errors.crm_archiveParamsRequired', 400);
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
    .from('banano_loyalty_voucher_month_archives')
    .select('storage_path')
    .eq('user_id', user.id)
    .eq('month_start', monthStart)
    .eq('archive_kind', kind)
    .maybeSingle();

  if (rowErr || !row) {
    return apiJsonError(request, 'errors.crm_archiveNotFoundForMonth', 404);
  }

  const path = String((row as { storage_path?: string }).storage_path ?? '');
  if (!path.includes('/') || !path.endsWith('.csv')) {
    return apiJsonError(request, 'errors.crm_invalidFilePath', 500);
  }

  const admin = createAdminClient();
  if (!admin) {
    return apiJsonError(request, 'errors.crm_serverConfigShort', 500);
  }

  const { data: blob, error: dlErr } = await admin.storage
    .from(BANANO_VOUCHER_MONTH_ARCHIVE_BUCKET)
    .download(path);

  if (dlErr || !blob) {
    console.error('[banano/voucher-month-archives/download]', dlErr?.message, path);
    return apiJsonError(request, 'errors.crm_fileNotFound', 404);
  }

  const ab = await blob.arrayBuffer();
  if (ab.byteLength === 0) {
    return apiJsonError(request, 'errors.crm_emptyFile', 404);
  }

  const suffix = kind === 'staff_allowance' ? 'collaborateurs' : 'clients-fidelite';
  const filename = `reputexa-bons-${suffix}-${y}-${String(m).padStart(2, '0')}.csv`;
  return new NextResponse(new Uint8Array(ab), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
