import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { assertPinFormat, hashBananoPin, verifyBananoPin } from '@/lib/banano/pin-crypto';

type Body =
  | { action: 'set' | 'verify'; pin: string }
  | { action: 'change'; currentPin: string; newPin: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const locale = apiLocaleFromRequest(req);
  const tm = createServerTranslator('ApiMerchant', locale);
  const tb = createServerTranslator('ApiBanano', locale);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return apiJsonError(req, 'errors.invalidJsonBody', 400);
  }

  if (body.action !== 'set' && body.action !== 'verify' && body.action !== 'change') {
    return NextResponse.json({ error: tm('bananoPinActionInvalid') }, { status: 400 });
  }

  const { data: profile, error: readErr } = await supabase
    .from('profiles')
    .select('banano_pin_hash')
    .eq('id', user.id)
    .maybeSingle();

  if (readErr) {
    console.error('[banano/pin read]', readErr.message);
    return NextResponse.json({ error: tb('bootstrapProfileReadFailed') }, { status: 500 });
  }

  if (body.action === 'change') {
    try {
      assertPinFormat(body.currentPin ?? '');
      assertPinFormat(body.newPin ?? '');
    } catch {
      return NextResponse.json({ error: tm('bananoPinFormatInvalid') }, { status: 400 });
    }
    if (!profile?.banano_pin_hash) {
      return NextResponse.json({ error: tm('bananoPinNotSetForChange') }, { status: 400 });
    }
    if (!verifyBananoPin(body.currentPin, profile.banano_pin_hash)) {
      return NextResponse.json({ error: tm('bananoPinCurrentIncorrect') }, { status: 401 });
    }
    const hashed = hashBananoPin(body.newPin);
    const { error: upErr } = await supabase
      .from('profiles')
      .update({ banano_pin_hash: hashed })
      .eq('id', user.id);
    if (upErr) {
      console.error('[banano/pin change]', upErr.message);
      return NextResponse.json({ error: tb('saveFailed') }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  try {
    assertPinFormat(body.pin ?? '');
  } catch {
    return NextResponse.json({ error: tm('bananoPinFormatInvalid') }, { status: 400 });
  }

  if (body.action === 'set') {
    if (profile?.banano_pin_hash) {
      return NextResponse.json({ error: tm('bananoPinAlreadyExists') }, { status: 409 });
    }
    const hashed = hashBananoPin(body.pin);
    const { error: upErr } = await supabase
      .from('profiles')
      .update({ banano_pin_hash: hashed })
      .eq('id', user.id);
    if (upErr) {
      console.error('[banano/pin set]', upErr.message);
      return NextResponse.json({ error: tb('saveFailed') }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const ok = verifyBananoPin(body.pin, profile?.banano_pin_hash);
  if (!ok) {
    return NextResponse.json({ ok: false, error: tm('bananoStaffPinWrong') }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
