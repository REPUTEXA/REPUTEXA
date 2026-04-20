import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

const BUCKET = 'admin-investor-reports';

async function requireAdmin() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: ta('unauthorized') }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: ta('forbidden') }, { status: 403 }) };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 }) };
  }
  return { admin } as const;
}

/** GET — téléchargement d’une archive PDF (admins). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;
  const { admin } = gate;
  const ta = apiAdminT();

  const { id } = await context.params;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: ta('complianceBundleIdMissing') }, { status: 400 });
  }

  const { data: row, error: rErr } = await admin
    .from('admin_investor_report_archives')
    .select('storage_path, file_name, byte_size')
    .eq('id', id)
    .maybeSingle();

  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }
  if (!row?.storage_path) {
    return NextResponse.json({ error: ta('investorReportArchiveNotFound') }, { status: 404 });
  }

  const { data: blob, error: dErr } = await admin.storage.from(BUCKET).download(row.storage_path);
  if (dErr || !blob) {
    console.error('[investor-report-archive download]', dErr);
    return NextResponse.json({ error: ta('investorReportStorageUnavailable') }, { status: 502 });
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  const downloadName =
    typeof row.file_name === 'string' && row.file_name.endsWith('.pdf')
      ? row.file_name
      : `${row.file_name ?? ta('investorReportDownloadDefaultBase')}.pdf`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(buf.length),
      'Content-Disposition': `attachment; filename="${downloadName.replace(/"/g, '')}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
