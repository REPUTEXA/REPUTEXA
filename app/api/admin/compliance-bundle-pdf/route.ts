import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadOperatorChecklist, normalizeOperatorChecklist } from '@/lib/admin/admin-operator-checklist';
import {
  buildComplianceBundlePdf,
  parseMonthYearParam,
} from '@/lib/admin/compliance-bundle-pdf';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: ta('unauthorized') }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: ta('adminOnly') }, { status: 403 }) };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 }) };
  }
  return { admin };
}

export async function GET(req: Request) {
  const r = await requireAdmin();
  if ('error' in r) return r.error;

  const url = new URL(req.url);
  const { year, month } = parseMonthYearParam(url.searchParams.get('month'));
  const signedByRaw = url.searchParams.get('signed_by');
  const signedBy =
    signedByRaw && signedByRaw.trim().length > 0 ? signedByRaw.trim().slice(0, 160) : null;

  const raw = await loadOperatorChecklist(r.admin);
  const operator = normalizeOperatorChecklist(raw);

  const pdf = await buildComplianceBundlePdf({ year, month, signedBy, operator });
  const buf = pdf.output('arraybuffer');
  const slug = `${year}-${String(month).padStart(2, '0')}`;

  return new NextResponse(Buffer.from(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reputexa-dossier-conformite-${slug}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
