/**
 * GET /api/admin/compliance/audit-export
 * JSON export — legal_compliance_logs journal + Guardian state for counsel / authority bundle.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }

  const [logsRes, guardianRes, consentsAgg] = await Promise.all([
    admin
      .from('legal_compliance_logs')
      .select('id, event_type, message, metadata, legal_version, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    admin.from('legal_guardian_state').select('*').eq('id', 1).maybeSingle(),
    admin.from('user_consents').select('country, consent_status'),
  ]);

  if (logsRes.error) {
    return NextResponse.json({ error: logsRes.error.message }, { status: 500 });
  }

  const byCountry: Record<string, { all: number; necessary: number; refused: number; total: number }> = {};
  for (const row of consentsAgg.data ?? []) {
    const c = String((row as { country?: string }).country ?? 'ZZ');
    const st = String((row as { consent_status?: string }).consent_status ?? '');
    if (!byCountry[c]) byCountry[c] = { all: 0, necessary: 0, refused: 0, total: 0 };
    byCountry[c].total++;
    if (st === 'all') byCountry[c].all++;
    else if (st === 'necessary') byCountry[c].necessary++;
    else if (st === 'refused') byCountry[c].refused++;
  }

  const body = {
    generated_at: new Date().toISOString(),
    product: 'REPUTEXA',
    export_kind: 'compliance_audit_bundle',
    legal_compliance_logs: logsRes.data ?? [],
    legal_guardian_state: guardianRes.data ?? null,
    consent_summary_by_country: byCountry,
  };

  const slug = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="reputexa-compliance-audit-${slug}.json"`,
    },
  });
}
