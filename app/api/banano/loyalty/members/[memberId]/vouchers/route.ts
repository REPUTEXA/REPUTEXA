import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createClient } from '@/lib/supabase/server';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { expireDueBananoVouchers } from '@/lib/banano/expire-loyalty-vouchers';
import { formatVoucherRewardLine } from '@/lib/banano/format-voucher-reward';
import { sortVouchersForMerchantDisplay } from '@/lib/banano/voucher-display-sort';

type Ctx = { params: Promise<{ memberId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const { memberId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  if (!memberId) {
    return NextResponse.json({ error: tm('invalidClient') }, { status: 400 });
  }

  await expireDueBananoVouchers(supabase, user.id);

  const { data: mem } = await supabase
    .from('banano_loyalty_members')
    .select('id')
    .eq('id', memberId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!mem) {
    return NextResponse.json({ error: tm('clientNotFound') }, { status: 404 });
  }

  const { data: rows, error } = await supabase
    .from('banano_loyalty_vouchers')
    .select('*')
    .eq('user_id', user.id)
    .eq('member_id', memberId)
    .limit(200);

  if (error) {
    console.error('[banano/members/vouchers]', error.message);
    return apiJsonError(req, 'errors.crm_readFailed', 500);
  }

  const sorted = sortVouchersForMerchantDisplay(rows ?? []);

  const vouchers = sorted.map((r) => ({
    ...r,
    rewardLine: formatVoucherRewardLine({
      reward_kind: String(r.reward_kind),
      reward_percent: r.reward_percent,
      reward_euro_cents: r.reward_euro_cents,
      reward_label: String(r.reward_label ?? ''),
    }),
  }));

  return NextResponse.json({ vouchers });
}
