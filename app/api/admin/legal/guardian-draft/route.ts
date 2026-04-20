/**
 * GET /api/admin/legal/guardian-draft — latest pending Guardian draft (admin session).
 * PATCH — mark verified or dismiss.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const ta = apiAdminT();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { user: null as null, supabase, error: NextResponse.json({ error: ta('unauthorized') }, { status: 401 }) };
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return { user: null as null, supabase, error: NextResponse.json({ error: ta('forbidden') }, { status: 403 }) };
  }
  return { user, supabase, error: null as null };
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const ta = apiAdminT();

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }

  const { data: draft, error } = await admin
    .from('legal_guardian_drafts')
    .select(
      'id, document_type, content_html, summary_of_changes, client_email_draft, detected_regions, created_at, dual_validation, admin_verified_at, admin_verified_by'
    )
    .eq('status', 'pending_admin')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ draft: draft ?? null });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  const { user } = gate;
  const ta = apiAdminT();
  const tApi = createServerTranslator('Api');
  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });

  let body: { draft_id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const draftId = typeof body.draft_id === 'string' ? body.draft_id.trim() : '';
  const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : '';
  if (!draftId || !action) {
    return NextResponse.json({ error: tApi('errors.draftActionRequired') }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('serverError') }, { status: 500 });
  }

  if (action === 'verify') {
    const { error } = await admin
      .from('legal_guardian_drafts')
      .update({
        admin_verified_at: new Date().toISOString(),
        admin_verified_by: user.id,
      })
      .eq('id', draftId)
      .eq('status', 'pending_admin');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'dismiss') {
    const { error } = await admin
      .from('legal_guardian_drafts')
      .update({ status: 'dismissed' })
      .eq('id', draftId)
      .eq('status', 'pending_admin');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: tApi('errors.verifyDismissUnknown') }, { status: 400 });
}
