import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createClient } from '@/lib/supabase/server';
import { formatEliteMonthLabel } from '@/lib/banano/elite-promo-message';
import { polishElitePromoOffer } from '@/lib/banano/polish-elite-promo-offer';
import { siteLocaleToIntlDateTag } from '@/lib/i18n/site-locales-catalog';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

export const dynamic = 'force-dynamic';

const MAX_DRAFT = 4000;

type Body = {
  memberId?: string;
  monthKey?: string;
  draftOffer?: string;
  favoriteDetail?: string | null;
  rank?: number;
  visitCount?: number;
  revenueCents?: number;
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
  const draftOffer = String(body.draftOffer ?? '').trim();

  if (!memberId) {
    return NextResponse.json({ error: 'member_required' }, { status: 400 });
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    return NextResponse.json({ error: 'invalid_month' }, { status: 400 });
  }
  if (draftOffer.length < 1) {
    return NextResponse.json({ error: 'draft_required' }, { status: 400 });
  }
  if (draftOffer.length > MAX_DRAFT) {
    return NextResponse.json({ error: 'draft_too_long', max: MAX_DRAFT }, { status: 400 });
  }

  const { data: member, error: memErr } = await supabase
    .from('banano_loyalty_members')
    .select('id, first_name, display_name')
    .eq('id', memberId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memErr || !member) {
    return NextResponse.json({ error: 'member_not_found' }, { status: 404 });
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('establishment_name, language, ai_custom_instructions, billing_currency')
    .eq('id', user.id)
    .maybeSingle();

  const establishmentName = ((prof as { establishment_name?: string } | null)?.establishment_name ?? '').trim();
  const merchantLocale = (prof as { language?: string | null } | null)?.language ?? null;
  const merchantDna = (prof as { ai_custom_instructions?: string | null } | null)?.ai_custom_instructions ?? null;
  const billingCurrency =
    ((prof as { billing_currency?: string | null } | null)?.billing_currency ?? 'eur').trim().toUpperCase() || 'EUR';

  const loc = normalizeAppLocale(merchantLocale ?? undefined);
  const intlTag = siteLocaleToIntlDateTag(loc);
  let revenueLabel: string | undefined;
  if (typeof body.revenueCents === 'number' && Number.isFinite(body.revenueCents) && body.revenueCents > 0) {
    revenueLabel = new Intl.NumberFormat(intlTag, {
      style: 'currency',
      currency: billingCurrency,
      maximumFractionDigits: billingCurrency === 'JPY' ? 0 : 2,
    }).format(body.revenueCents / 100);
  }

  const first =
    ((member as { first_name?: string | null }).first_name ?? '').trim() ||
    String((member as { display_name?: string }).display_name ?? '')
      .trim()
      .split(/\s+/)[0] ||
    '';

  const monthLabel = formatEliteMonthLabel(monthKey, merchantLocale);

  const polished = await polishElitePromoOffer({
    draftOffer,
    locale: merchantLocale,
    establishmentName,
    firstName: first,
    monthLabel,
    favoriteDetail: body.favoriteDetail ?? null,
    rank: typeof body.rank === 'number' ? body.rank : undefined,
    visitCount: typeof body.visitCount === 'number' ? body.visitCount : undefined,
    revenueLabel,
    memberId,
    merchantDna,
  });

  return NextResponse.json({ ok: true, polished });
}
