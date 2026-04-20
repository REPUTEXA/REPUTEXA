import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { resolveGhostAgentMerchantId } from '@/lib/banano/ghost-auth';
import { normalizeBananoVoucherCode } from '@/lib/banano/loyalty-voucher-code';
import { expireDueBananoVouchers } from '@/lib/banano/expire-loyalty-vouchers';
import { formatVoucherRewardLine } from '@/lib/banano/format-voucher-reward';
import {
  parseLoyaltyIdempotencyKey,
  readLoyaltyIdempotentJson,
  saveLoyaltyIdempotentJson,
} from '@/lib/banano/loyalty-idempotency';

type Body = {
  code?: string;
  idempotencyKey?: string;
};

/**
 * POST — Encaisse un bon fidélité (VCHR-…) avec jeton Agent Ghost (équivalent sécurisé du terminal).
 * Les bons « collaborateur » (staff_allowance) restent réservés au terminal avec débit partiel.
 */
export async function POST(req: Request) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const admin = createAdminClient();
  if (!admin) {
    return apiJsonError(req, 'serviceUnavailable', 503);
  }

  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const merchantId = await resolveGhostAgentMerchantId(admin, bearer);
  if (!merchantId) {
    return NextResponse.json({ error: tm('ghostAgentTokenInvalid') }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const idemKey = parseLoyaltyIdempotencyKey(body.idempotencyKey);
  if (idemKey) {
    const cached = await readLoyaltyIdempotentJson(admin, merchantId, idemKey);
    if (cached && cached.ok === true) {
      return NextResponse.json(cached);
    }
  }

  const code = normalizeBananoVoucherCode(String(body.code ?? ''));
  if (code.length < 8) {
    return NextResponse.json({ error: tm('ghostVoucherCodeInvalid') }, { status: 400 });
  }

  await expireDueBananoVouchers(admin, merchantId);

  const { data: v, error: vReadErr } = await admin
    .from('banano_loyalty_vouchers')
    .select('*')
    .eq('user_id', merchantId)
    .eq('public_code', code)
    .maybeSingle();

  if (vReadErr || !v) {
    return NextResponse.json({ error: tm('staffVoucherNotFound') }, { status: 404 });
  }

  const voucherClass = String((v as { voucher_class?: string }).voucher_class ?? 'loyalty_threshold');
  if (voucherClass === 'staff_allowance') {
    return NextResponse.json(
      {
        error: tm('ghostStaffVoucherUseTerminal'),
      },
      { status: 400 }
    );
  }

  const expiredByDate =
    typeof v.expires_at === 'string' && v.expires_at && new Date(v.expires_at).getTime() < Date.now();

  if (v.status === 'redeemed') {
    return NextResponse.json({ error: tm('ghostVoucherAlreadyRedeemed') }, { status: 409 });
  }
  if (v.status === 'expired' || expiredByDate) {
    return NextResponse.json({ error: tm('ghostVoucherExpired') }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: updated, error: upErr } = await admin
    .from('banano_loyalty_vouchers')
    .update({
      status: 'redeemed',
      redeemed_at: now,
      redeemed_by_staff_id: null,
    })
    .eq('id', v.id)
    .eq('user_id', merchantId)
    .eq('status', 'available')
    .select('*')
    .maybeSingle();

  if (upErr || !updated) {
    return NextResponse.json(
      { error: tm('ghostVoucherRedeemFailed') },
      { status: 409 }
    );
  }

  await admin.from('banano_loyalty_events').insert({
    user_id: merchantId,
    member_id: v.member_id,
    event_type: 'voucher_redeemed',
    delta_points: 0,
    delta_stamps: 0,
    note: tm('ghostVoucherRedeemEventNote', { code }),
    staff_id: null,
  });

  void admin.from('banano_ghost_audit_events').insert({
    user_id: merchantId,
    member_id: typeof v.member_id === 'string' ? v.member_id : null,
    action: 'voucher_redeem',
    payload: { code },
  });

  const rewardLine = formatVoucherRewardLine({
    reward_kind: String(v.reward_kind),
    reward_percent: v.reward_percent,
    reward_euro_cents: v.reward_euro_cents,
    reward_label: String(v.reward_label ?? ''),
  });

  const loyaltyBody = {
    ok: true as const,
    voucher: updated,
    rewardLine,
    voucherClass: 'loyalty_threshold' as const,
  };

  if (idemKey) {
    await saveLoyaltyIdempotentJson(
      admin,
      merchantId,
      idemKey,
      'voucher_redeem',
      loyaltyBody as unknown as Record<string, unknown>
    );
  }

  return NextResponse.json(loyaltyBody);
}
