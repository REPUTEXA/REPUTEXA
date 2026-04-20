import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ta = apiAdminT();
  const tApi = createServerTranslator('Api');
  const { id: clientId } = await context.params;
  if (!UUID_RE.test(clientId)) {
    return NextResponse.json({ error: ta('adminClientsInvalidId') }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: ta('unauthorized') }, { status: 401 });

  const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (adminProfile?.role !== 'admin') {
    return NextResponse.json({ error: ta('forbidden') }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  let body: { daily_soft_limit?: unknown; daily_hard_limit?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const soft =
    typeof body.daily_soft_limit === 'number' && Number.isFinite(body.daily_soft_limit)
      ? Math.floor(body.daily_soft_limit)
      : null;
  const hard =
    typeof body.daily_hard_limit === 'number' && Number.isFinite(body.daily_hard_limit)
      ? Math.floor(body.daily_hard_limit)
      : null;

  if (soft == null || hard == null || soft < 1 || hard < soft + 1) {
    return NextResponse.json(
      { error: tApi('errors.softHardLimitRequired') },
      { status: 400 }
    );
  }

  const { data: row } = await admin
    .from('ai_llm_usage_budget')
    .select('user_id, period_start, call_count')
    .eq('user_id', clientId)
    .maybeSingle();

  const periodStart =
    typeof row?.period_start === 'string'
      ? row.period_start
      : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())).toISOString();
  const count = typeof row?.call_count === 'number' ? row.call_count : 0;

  const { data: saved, error } = await admin
    .from('ai_llm_usage_budget')
    .upsert(
      {
        user_id: clientId,
        period_start: periodStart,
        call_count: count,
        daily_soft_limit: soft,
        daily_hard_limit: hard,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('user_id, period_start, call_count, daily_soft_limit, daily_hard_limit, updated_at')
    .single();

  if (error) {
    console.error('[ai-budget PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(saved);
}
