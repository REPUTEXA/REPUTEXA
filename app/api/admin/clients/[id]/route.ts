/**
 * GET /api/admin/clients/[id]
 * Fiche complète d’un profil (select *) + métadonnées Auth — réservé admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ta = apiAdminT();
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: ta('adminClientsInvalidId') }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });
  }

  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  if (adminProfile?.role !== 'admin') {
    return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  const { data: profile, error } = await admin.from('profiles').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: ta('adminClientsProfileNotFound') }, { status: 404 });
    }
    console.error('[admin/clients/id]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type AuthSnapshot = {
    email: string | undefined;
    email_confirmed_at: string | undefined;
    last_sign_in_at: string | undefined;
    created_at: string | undefined;
    phone: string | undefined;
  } | null;

  let auth_user: AuthSnapshot = null;
  try {
    const { data: authData, error: authErr } = await admin.auth.admin.getUserById(id);
    if (!authErr && authData.user) {
      const u = authData.user;
      auth_user = {
        email: u.email,
        email_confirmed_at: u.email_confirmed_at,
        last_sign_in_at: u.last_sign_in_at,
        created_at: u.created_at,
        phone: u.phone,
      };
    }
  } catch (e) {
    console.warn('[admin/clients/id] auth snapshot', e);
  }

  const [
    { data: consent_logs, error: consentErr },
    { data: establishments, error: estabErr },
    { data: ai_budget, error: budgetErr },
  ] = await Promise.all([
    admin
      .from('consent_logs')
      .select('id, created_at, consent_type, channel, message_preview, metadata')
      .eq('merchant_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    admin.from('establishments').select('*').eq('user_id', id).order('display_order', { ascending: true }),
    admin
      .from('ai_llm_usage_budget')
      .select('period_start, call_count, daily_soft_limit, daily_hard_limit, updated_at')
      .eq('user_id', id)
      .maybeSingle(),
  ]);

  if (consentErr) {
    console.warn('[admin/clients/id] consent_logs', consentErr);
  }
  if (estabErr) {
    console.warn('[admin/clients/id] establishments', estabErr);
  }
  if (budgetErr) {
    console.warn('[admin/clients/id] ai_llm_usage_budget', budgetErr);
  }

  return NextResponse.json({
    profile,
    auth_user,
    consent_logs: consent_logs ?? [],
    establishments: establishments ?? [],
    ai_budget: ai_budget ?? null,
  });
}
