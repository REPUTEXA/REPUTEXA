import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { dispatchElitePromoWhatsApp, MAX_ELITE_OFFER_LEN } from '@/lib/banano/elite-promo-dispatch';

export const dynamic = 'force-dynamic';

const MAX_BATCH = 12;
const PAUSE_MS = 450;

type SendItem = {
  memberId?: string;
  offerText?: string;
};

type Body = {
  monthKey?: string;
  /** Un texte d’offre par client (ex. versions personnalisées par l’IA). */
  sends?: SendItem[];
  audioStoragePath?: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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

  const monthKey = typeof body.monthKey === 'string' ? body.monthKey.trim() : '';
  const audioStoragePath =
    typeof body.audioStoragePath === 'string' && body.audioStoragePath.trim()
      ? body.audioStoragePath.trim()
      : null;

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    return NextResponse.json({ error: 'invalid_month' }, { status: 400 });
  }

  const raw = Array.isArray(body.sends) ? body.sends : [];
  const byMember = new Map<string, string>();
  for (const item of raw) {
    const mid = String(item.memberId ?? '').trim();
    const text = String(item.offerText ?? '').trim();
    if (!mid || !text) continue;
    if (text.length > MAX_ELITE_OFFER_LEN) {
      return NextResponse.json({ error: 'offer_too_long', memberId: mid }, { status: 400 });
    }
    byMember.set(mid, text);
  }

  const sends = [...byMember.entries()].slice(0, MAX_BATCH).map(([memberId, offerText]) => ({
    memberId,
    offerText,
  }));

  if (sends.length < 1) {
    return NextResponse.json({ error: 'sends_required' }, { status: 400 });
  }

  const results: { memberId: string; ok: boolean; error?: string; messageId?: string }[] = [];

  for (let i = 0; i < sends.length; i++) {
    const { memberId, offerText } = sends[i];
    const res = await dispatchElitePromoWhatsApp({
      supabase,
      merchantUserId: user.id,
      memberId,
      monthKey,
      offerText,
      audioStoragePath,
    });
    if (res.ok) {
      results.push({ memberId, ok: true, messageId: res.messageId });
    } else {
      results.push({ memberId, ok: false, error: res.error });
    }
    if (i < sends.length - 1) {
      await sleep(PAUSE_MS);
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  return NextResponse.json({
    ok: failed === 0,
    results,
    sent: results.filter((r) => r.ok).length,
    failed,
  });
}
