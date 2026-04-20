import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { verifyBananoPin } from '@/lib/banano/pin-crypto';

type Body = { staffId: string; pin: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));

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

  const staffId = (body.staffId ?? '').trim();
  const pin = (body.pin ?? '').trim();
  if (!staffId || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: tm('bananoStaffVerifyPinInvalid') }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from('banano_terminal_staff')
    .select('id, display_name, pin_hash, is_active')
    .eq('id', staffId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[banano/staff/verify]', error.message);
    return NextResponse.json({ error: tm('serverError') }, { status: 500 });
  }

  if (!row || !row.is_active) {
    return NextResponse.json({ error: tm('bananoStaffInactiveOrDisabled') }, { status: 404 });
  }

  const ok = verifyBananoPin(pin, row.pin_hash as string);
  if (!ok) {
    return NextResponse.json({ error: tm('bananoStaffPinWrong') }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    staff: { id: row.id, display_name: row.display_name },
  });
}
