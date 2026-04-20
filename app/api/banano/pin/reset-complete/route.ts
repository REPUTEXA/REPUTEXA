import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertPinFormat, hashBananoPin } from '@/lib/banano/pin-crypto';
import { hashPinResetToken } from '@/lib/banano/pin-reset-token';

/**
 * POST /api/banano/pin/reset-complete
 * Corps : { token, pin } — pas de session requise ; le jeton prouve la possession de l’e-mail.
 */
export async function POST(req: Request) {
  const locale = apiLocaleFromRequest(req);
  const tm = createServerTranslator('ApiMerchant', locale);
  const tb = createServerTranslator('ApiBanano', locale);

  let body: { token?: string; pin?: string };
  try {
    body = (await req.json()) as { token?: string; pin?: string };
  } catch {
    return apiJsonError(req, 'errors.invalidJsonBody', 400);
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const pin = typeof body.pin === 'string' ? body.pin : '';

  if (!token) {
    return NextResponse.json({ error: tm('bananoPinResetLinkIncomplete') }, { status: 400 });
  }

  try {
    assertPinFormat(pin);
  } catch {
    return NextResponse.json({ error: tm('bananoPinFormatInvalid') }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: tb('serviceUnavailable') }, { status: 503 });
  }

  const token_hash = hashPinResetToken(token);
  const now = new Date().toISOString();

  const { data: row, error: findErr } = await admin
    .from('banano_pin_reset_tokens')
    .select('id, user_id')
    .eq('token_hash', token_hash)
    .is('used_at', null)
    .gt('expires_at', now)
    .maybeSingle();

  if (findErr) {
    console.error('[banano/pin/reset-complete find]', findErr);
    return NextResponse.json({ error: tb('serverError') }, { status: 500 });
  }

  if (!row?.user_id) {
    return NextResponse.json({ error: tm('bananoPinResetLinkInvalidOrExpired') }, { status: 400 });
  }

  const hashed = hashBananoPin(pin);

  const { error: upProfile } = await admin
    .from('profiles')
    .update({ banano_pin_hash: hashed })
    .eq('id', row.user_id);

  if (upProfile) {
    console.error('[banano/pin/reset-complete profile]', upProfile);
    return NextResponse.json({ error: tm('updateFailed') }, { status: 500 });
  }

  const { error: markUsed } = await admin
    .from('banano_pin_reset_tokens')
    .update({ used_at: now })
    .eq('id', row.id);

  if (markUsed) {
    console.error('[banano/pin/reset-complete token]', markUsed);
  }

  return NextResponse.json({ ok: true });
}
