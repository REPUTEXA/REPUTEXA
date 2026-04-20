import QRCode from 'qrcode';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { normalizeBananoVoucherCode } from '@/lib/banano/loyalty-voucher-code';

export async function GET(req: Request) {
  const supabase = await createClient();
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const code = normalizeBananoVoucherCode(new URL(req.url).searchParams.get('code') ?? '');
  if (code.length < 8) {
    return NextResponse.json({ error: tm('ghostVoucherCodeInvalid') }, { status: 400 });
  }

  const { data: v } = await supabase
    .from('banano_loyalty_vouchers')
    .select('id')
    .eq('user_id', user.id)
    .eq('public_code', code)
    .maybeSingle();

  if (!v) {
    return NextResponse.json({ error: tm('notFound') }, { status: 404 });
  }

  const png = await QRCode.toBuffer(code, {
    type: 'png',
    width: 280,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
    },
  });
}
