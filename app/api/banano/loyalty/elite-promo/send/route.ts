import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { dispatchElitePromoWhatsApp } from '@/lib/banano/elite-promo-dispatch';

export const dynamic = 'force-dynamic';

type Body = {
  memberId?: string;
  monthKey?: string;
  offerText?: string;
  audioStoragePath?: string | null;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const memberId = typeof body.memberId === 'string' ? body.memberId.trim() : '';
  const monthKey = typeof body.monthKey === 'string' ? body.monthKey.trim() : '';
  const offerText = String(body.offerText ?? '').trim();
  const audioStoragePath =
    typeof body.audioStoragePath === 'string' && body.audioStoragePath.trim()
      ? body.audioStoragePath.trim()
      : null;

  if (!memberId) {
    return NextResponse.json({ error: 'member_required' }, { status: 400 });
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    return NextResponse.json({ error: 'invalid_month' }, { status: 400 });
  }

  const res = await dispatchElitePromoWhatsApp({
    supabase,
    merchantUserId: user.id,
    memberId,
    monthKey,
    offerText,
    audioStoragePath,
  });

  if (!res.ok) {
    const status = res.status;
    const err = res.error;
    if (err === 'whatsapp_failed') {
      return NextResponse.json({ error: err, detail: null }, { status });
    }
    return NextResponse.json({ error: err }, { status });
  }

  return NextResponse.json({
    ok: true,
    messageId: res.messageId,
  });
}
