import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runLegalGuardian } from '@/lib/legal/guardian-run';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const ta = apiAdminT();
  const tApi = createServerTranslator('Api');
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

  let body: { fixId?: string };
  try {
    body = (await req.json()) as { fixId?: string };
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  if (body.fixId !== 'trigger_guardian') {
    return NextResponse.json({ error: tApi('errors.actionNotAutomatable') }, { status: 400 });
  }

  try {
    const result = await runLegalGuardian();
    const gr = result as { status?: string; summary?: string; draftId?: string };
    await admin.from('legal_compliance_logs').insert({
      event_type: 'ai_audit',
      message: ta('sentinel360GuardianManualLog', { status: String(gr.status) }),
      metadata: {
        kind: 'sentinel_360_fix',
        fixId: 'trigger_guardian',
        guardian_status: gr.status,
        draft_id: gr.draftId ?? null,
      },
      legal_version: null,
    });
    return NextResponse.json({ ok: true, guardian: result });
  } catch (e) {
    console.error('[sentinel-360/apply]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : ta('sentinel360GuardianFailed') },
      { status: 500 }
    );
  }
}
