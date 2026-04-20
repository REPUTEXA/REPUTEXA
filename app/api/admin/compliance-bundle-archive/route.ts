import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createComplianceBundleArchive } from '@/lib/admin/compliance-bundle-archive';
import { parseMonthYearParam } from '@/lib/admin/compliance-bundle-pdf';
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
  return { user, admin } as const;
}

/** GET — list archives (newest first). */
export async function GET() {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;
  const { admin } = gate;

  const { data, error } = await admin
    .from('admin_compliance_bundle_archives')
    .select(
      'id, created_at, created_by, source, period_year, period_month, file_name, byte_size, content_sha256, signed_by, summary'
    )
    .order('created_at', { ascending: false })
    .limit(72);

  if (error) {
    console.error('[compliance-bundle-archive GET]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ archives: data ?? [] });
}

/** POST — generate and archive immediately (manual source). Body JSON { month?, signed_by? } */
export async function POST(req: Request) {
  const gate = await requireAdmin();
  if ('error' in gate) return gate.error;
  const { user, admin } = gate;

  const ta = apiAdminT();
  let body: { month?: string; signed_by?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const { year, month } = parseMonthYearParam(body.month ?? null);
  const signedBy =
    typeof body.signed_by === 'string' && body.signed_by.trim().length > 0
      ? body.signed_by.trim().slice(0, 160)
      : null;

  const result = await createComplianceBundleArchive(admin, {
    year,
    month,
    signedBy,
    source: 'manual',
    createdByUserId: user.id,
    skipIfCronExists: false,
  });

  if (!result.ok) {
    console.error('[compliance-bundle-archive POST]', result.error);
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  if ('skipped' in result && result.skipped) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (!('id' in result) || !result.id) {
    return NextResponse.json({ error: ta('complianceBundleArchiveMissingId') }, { status: 500 });
  }

  const { data: row } = await admin
    .from('admin_compliance_bundle_archives')
    .select(
      'id, created_at, source, period_year, period_month, file_name, byte_size, signed_by, summary'
    )
    .eq('id', result.id)
    .single();

  return NextResponse.json({ ok: true, archive: row });
}
