import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createClient } from '@/lib/supabase/server';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

type Ctx = { params: { id: string } };

/**
 * DELETE — Révoque un jeton Agent (PC volé, départ employé, etc.).
 */
export async function DELETE(req: Request, context: Ctx) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const id = context.params?.id?.trim();
  if (!id) {
    return NextResponse.json({ error: tm('ghostAgentTokenIdMissing') }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('banano_ghost_agent_tokens')
    .update({ revoked_at: now })
    .eq('id', id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[ghost/agent-token revoke]', error.message);
    return NextResponse.json({ error: tm('ghostAgentTokenRevokeFailed') }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: tm('ghostAgentTokenRevokeNotFound') }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
