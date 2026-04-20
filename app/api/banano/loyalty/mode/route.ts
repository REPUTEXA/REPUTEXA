import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';

type Body = { mode: 'points' | 'stamps' };

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const locale = apiLocaleFromRequest(req);
  const tm = createServerTranslator('ApiMerchant', locale);
  const tSettings = createServerTranslator('LoyaltySettings', locale);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  if (body.mode !== 'points' && body.mode !== 'stamps') {
    return NextResponse.json({ error: tSettings('modeInvalid') }, { status: 400 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ banano_loyalty_mode: body.mode })
    .eq('id', user.id);

  if (error) {
    console.error('[banano/loyalty/mode]', error.message);
    return NextResponse.json({ error: tm('updateFailed') }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode: body.mode });
}
