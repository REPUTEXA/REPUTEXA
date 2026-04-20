import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { COMPLIANCE_BUNDLE_BUCKET } from '@/lib/admin/compliance-bundle-archive';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

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
    return { error: NextResponse.json({ error: ta('adminOnly') }, { status: 403 }) };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: ta('serviceUnavailable') }, { status: 503 }) };
  }
  return { admin } as const;
}

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
    .from('admin_compliance_bundle_archives')
    .select('storage_path, file_name')
    .eq('id', id)
    .maybeSingle();

  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }
  if (!row?.storage_path) {
    return NextResponse.json({ error: ta('complianceBundleArchiveNotFound') }, { status: 404 });
  }

  const { data: blob, error: dErr } = await admin.storage
    .from(COMPLIANCE_BUNDLE_BUCKET)
    .download(row.storage_path);

  if (dErr || !blob) {
    console.error('[compliance-bundle-archive download]', dErr);
    return NextResponse.json({ error: ta('complianceBundleStorageUnavailable') }, { status: 502 });
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  const downloadName =
    typeof row.file_name === 'string' && row.file_name.endsWith('.pdf')
      ? row.file_name
      : `${row.file_name ?? ta('complianceBundleDownloadDefaultBase')}.pdf`;

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
