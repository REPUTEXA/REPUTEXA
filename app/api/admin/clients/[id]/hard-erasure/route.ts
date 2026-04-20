import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  executeMerchantHardErasure,
  MERCHANT_ERASURE_CONFIRM,
} from '@/lib/admin/merchant-hard-erasure';
import { apiAdminT } from '@/lib/i18n/api-admin-translator';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ta = apiAdminT();
  const tApi = createServerTranslator('Api');
  const { id: targetUserId } = await context.params;
  if (!UUID_RE.test(targetUserId)) {
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

  let body: { confirm?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: ta('jsonInvalid') }, { status: 400 });
  }

  const phrase = typeof body.confirm === 'string' ? body.confirm : '';
  if (phrase.trim().toUpperCase() !== MERCHANT_ERASURE_CONFIRM) {
    return NextResponse.json(
      {
        error: tApi('errors.wrongConfirmation'),
        hint: tApi('errors.hardErasureConfirmHint', { phrase: MERCHANT_ERASURE_CONFIRM }),
      },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: ta('adminClientMissing') }, { status: 500 });
  }

  try {
    const result = await executeMerchantHardErasure(admin, {
      targetUserId,
      actorAdminId: user.id,
      confirmPhrase: phrase,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : ta('serverError');
    const map: Record<string, number> = {
      CONFIRMATION_INVALIDE: 400,
      AUTO_SUPPRESSION_INTERDITE: 400,
      SUPPRESSION_ADMIN_INTERDITE: 403,
      PROFILE_NOT_FOUND: 404,
    };
    const status = map[msg] ?? 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
