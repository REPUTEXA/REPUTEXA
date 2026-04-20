import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateGhostAgentPlainToken, sha256Hex } from '@/lib/banano/ghost-agent-token';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

/**
 * POST — Crée un jeton Agent Ghost pour la caisse Windows (affiché une seule fois).
 */
export async function POST(req: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let label = '';
  try {
    const j = (await req.json().catch(() => ({}))) as { label?: unknown };
    if (typeof j.label === 'string') label = j.label.slice(0, 80);
  } catch {
    label = '';
  }

  const admin = createAdminClient();
  if (!admin) {
    return apiJsonError(req, 'serviceUnavailable', 503);
  }

  const plain = generateGhostAgentPlainToken();
  const token_sha256 = sha256Hex(plain);

  const { data: row, error } = await admin
    .from('banano_ghost_agent_tokens')
    .insert({
      user_id: user.id,
      token_sha256,
      label: label || tm('ghostAgentDefaultLabel'),
    })
    .select('id')
    .maybeSingle();

  if (error || !row?.id) {
    console.error('[ghost/agent-token]', error?.message);
    return NextResponse.json({ error: tm('tokenCreateFailed') }, { status: 500 });
  }

  return NextResponse.json({
    id: row.id as string,
    token: plain,
    hint: tm('ghostAgentTokenHint'),
  });
}
