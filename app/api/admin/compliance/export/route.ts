/**
 * GET /api/admin/compliance/export?format=csv&dataset=consents
 * Site consent evidence export for audit (authenticated admin only).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

function csvEscape(s: string): string {
  const x = s.replace(/"/g, '""');
  return `"${x}"`;
}

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

  const { data: rows, error } = await admin
    .from('user_consents')
    .select(
      'id, user_id, anonymous_id, consent_status, country, legal_version_id, ui_locale, navigator_language, accept_language, analytics_opt_in, marketing_opt_in, gpc_signal_observed, created_at, updated_at'
    )
    .order('updated_at', { ascending: false })
    .limit(50000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = rows ?? [];
  const header = [
    'id',
    'user_id',
    'anonymous_id',
    'consent_status',
    'country',
    'legal_version_id',
    'ui_locale',
    'navigator_language',
    'accept_language',
    'analytics_opt_in',
    'marketing_opt_in',
    'gpc_signal_observed',
    'created_at',
    'updated_at',
  ];
  const lines = [
    header.join(','),
    ...list.map((r) =>
      [
        csvEscape(String(r.id)),
        csvEscape(String(r.user_id ?? '')),
        csvEscape(String(r.anonymous_id ?? '')),
        csvEscape(String(r.consent_status)),
        csvEscape(String(r.country)),
        String(r.legal_version_id ?? ''),
        csvEscape(String((r as { ui_locale?: string }).ui_locale ?? '')),
        csvEscape(String((r as { navigator_language?: string }).navigator_language ?? '')),
        csvEscape(String((r as { accept_language?: string }).accept_language ?? '')),
        String((r as { analytics_opt_in?: boolean }).analytics_opt_in === true ? '1' : '0'),
        String((r as { marketing_opt_in?: boolean }).marketing_opt_in === true ? '1' : '0'),
        String((r as { gpc_signal_observed?: boolean }).gpc_signal_observed === true ? '1' : '0'),
        csvEscape(String(r.created_at ?? '')),
        csvEscape(String(r.updated_at ?? '')),
      ].join(',')
    ),
  ];

  const csv = lines.join('\n');
  const slug = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reputexa-user-consents-${slug}.csv"`,
    },
  });
}
