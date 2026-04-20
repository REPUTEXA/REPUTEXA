import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runSentinel360Audit } from '@/lib/admin/sentinel-360-audit';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: ta('adminOnly') }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  try {
    const report = await runSentinel360Audit(admin, { logToCompliance: true });
    return NextResponse.json(report);
  } catch (e) {
    console.error('[sentinel-360/scan]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('sentinel360AuditFailed') },
      { status: 500 }
    );
  }
}
