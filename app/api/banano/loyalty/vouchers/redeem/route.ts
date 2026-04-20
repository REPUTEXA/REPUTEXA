import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { assertTerminalStaffActive } from '@/lib/banano/assert-terminal-staff';
import { normalizeBananoVoucherCode } from '@/lib/banano/loyalty-voucher-code';
import { expireDueBananoVouchers } from '@/lib/banano/expire-loyalty-vouchers';
import { formatVoucherRewardLine } from '@/lib/banano/format-voucher-reward';
import {
  parseLoyaltyIdempotencyKey,
  readLoyaltyIdempotentJson,
  saveLoyaltyIdempotentJson,
} from '@/lib/banano/loyalty-idempotency';

const INTL_BY_APP: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

function intlTagForLocale(locale: string): string {
  return INTL_BY_APP[locale] ?? 'fr-FR';
}

function formatEurosWithUnit(euroFloat: number, centsSource: number, locale: string): string {
  const tag = intlTagForLocale(locale);
  const minFrac = centsSource % 100 === 0 ? 0 : 2;
  const n = new Intl.NumberFormat(tag, {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: 2,
  }).format(euroFloat);
  return `${n} €`;
}

type Body = {
  code?: string;
  memberId?: string;
  staffId?: string | null;
  /** Utilisation partielle bon collaborateur (centimes à déduire du solde). */
  debitEuroCents?: number;
  idempotencyKey?: string;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const locale = apiLocaleFromRequest(req);
  const tm = createServerTranslator('ApiMerchant', locale);
  const tLoyalty = createServerTranslator('Loyalty', locale);

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

  const idemKey = parseLoyaltyIdempotencyKey(body.idempotencyKey);
  if (idemKey) {
    const cached = await readLoyaltyIdempotentJson(supabase, user.id, idemKey);
    if (cached && cached.ok === true) {
      return NextResponse.json(cached);
    }
  }

  const code = normalizeBananoVoucherCode(String(body.code ?? ''));
  if (code.length < 8) {
    return NextResponse.json({ error: tm('ghostVoucherCodeInvalid') }, { status: 400 });
  }

  await expireDueBananoVouchers(supabase, user.id);

  const staffCheck = await assertTerminalStaffActive(supabase, user.id, body.staffId ?? undefined, tLoyalty);
  if (!staffCheck.ok) {
    return NextResponse.json({ error: staffCheck.error }, { status: 400 });
  }

  const { data: v, error: vReadErr } = await supabase
    .from('banano_loyalty_vouchers')
    .select('*')
    .eq('user_id', user.id)
    .eq('public_code', code)
    .maybeSingle();

  if (vReadErr || !v) {
    return NextResponse.json({ error: tm('staffVoucherNotFound') }, { status: 404 });
  }

  if (body.memberId && typeof body.memberId === 'string' && v.member_id !== body.memberId) {
    return NextResponse.json({ error: tm('loyaltyRedeemWrongMember') }, { status: 400 });
  }

  const expiredByDate =
    typeof v.expires_at === 'string' && v.expires_at && new Date(v.expires_at).getTime() < Date.now();

  if (v.status === 'redeemed') {
    return NextResponse.json({ error: tm('ghostVoucherAlreadyRedeemed') }, { status: 409 });
  }
  if (v.status === 'expired' || expiredByDate) {
    return NextResponse.json({ error: tm('ghostVoucherExpired') }, { status: 400 });
  }

  const voucherClass = String((v as { voucher_class?: string }).voucher_class ?? 'loyalty_threshold');
  const now = new Date().toISOString();

  if (voucherClass === 'staff_allowance') {
    const remaining = Math.floor(
      Number((v as { remaining_euro_cents?: number | null }).remaining_euro_cents ?? 0)
    );
    if (!(remaining > 0)) {
      return NextResponse.json({ error: tm('loyaltyRedeemStaffDepleted') }, { status: 400 });
    }
    const debit = Math.floor(Number(body.debitEuroCents));
    if (!Number.isFinite(debit) || debit < 1) {
      return NextResponse.json({ error: tm('loyaltyRedeemStaffDebitRequired') }, { status: 400 });
    }
    if (debit > remaining) {
      const tag = intlTagForLocale(locale);
      const maxEuro = remaining / 100;
      const maxStr = new Intl.NumberFormat(tag, {
        minimumFractionDigits: remaining % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(maxEuro);
      return NextResponse.json({ error: tm('loyaltyRedeemStaffDebitExceeds', { max: maxStr }) }, { status: 400 });
    }

    const newRem = remaining - debit;
    const fullySpent = newRem <= 0;

    const { data: updated, error: upErr } = await supabase
      .from('banano_loyalty_vouchers')
      .update({
        remaining_euro_cents: newRem,
        points_balance_after: newRem,
        status: fullySpent ? 'redeemed' : 'available',
        redeemed_at: fullySpent ? now : null,
        redeemed_by_staff_id:
          fullySpent && body.staffId && typeof body.staffId === 'string' ? body.staffId : null,
      })
      .eq('id', v.id)
      .eq('user_id', user.id)
      .eq('status', 'available')
      .select('*')
      .maybeSingle();

    if (upErr || !updated) {
      return NextResponse.json({ error: tm('loyaltyRedeemStaffApplyConflict') }, { status: 409 });
    }

    const debitEuros = debit / 100;
    const remEuros = newRem / 100;
    const debitLabel = formatEurosWithUnit(debitEuros, debit, locale);
    const remLabel = formatEurosWithUnit(remEuros, newRem, locale);

    await supabase.from('banano_loyalty_events').insert({
      user_id: user.id,
      member_id: v.member_id,
      event_type: 'staff_allowance_debit',
      delta_points: 0,
      delta_stamps: 0,
      note: tm('loyaltyRedeemStaffEventNote', { code, debit: debitLabel, remaining: remLabel }),
      staff_id: body.staffId && typeof body.staffId === 'string' ? body.staffId : null,
      amount_cents: debit,
    });

    const rewardLine = formatVoucherRewardLine({
      reward_kind: String(v.reward_kind),
      reward_percent: v.reward_percent,
      reward_euro_cents: v.reward_euro_cents,
      reward_label: String(v.reward_label ?? ''),
    });

    const allowanceBody = {
      ok: true as const,
      voucher: updated,
      rewardLine,
      voucherClass: 'staff_allowance' as const,
      debitEuroCents: debit,
      remainingEuroCents: newRem,
      appliedEurosFormatted: debitLabel,
      remainingEurosFormatted: remLabel,
    };
    if (idemKey) {
      await saveLoyaltyIdempotentJson(
        supabase,
        user.id,
        idemKey,
        'voucher_redeem',
        allowanceBody as unknown as Record<string, unknown>
      );
    }
    return NextResponse.json(allowanceBody);
  }

  const { data: updated, error: upErr } = await supabase
    .from('banano_loyalty_vouchers')
    .update({
      status: 'redeemed',
      redeemed_at: now,
      redeemed_by_staff_id: body.staffId && typeof body.staffId === 'string' ? body.staffId : null,
    })
    .eq('id', v.id)
    .eq('user_id', user.id)
    .eq('status', 'available')
    .select('*')
    .maybeSingle();

  if (upErr || !updated) {
    return NextResponse.json({ error: tm('ghostVoucherRedeemFailed') }, { status: 409 });
  }

  await supabase.from('banano_loyalty_events').insert({
    user_id: user.id,
    member_id: v.member_id,
    event_type: 'voucher_redeemed',
    delta_points: 0,
    delta_stamps: 0,
    note: tm('loyaltyRedeemUsageNote', { code }),
    staff_id: body.staffId && typeof body.staffId === 'string' ? body.staffId : null,
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
    voucherClass:
      voucherClass === 'elite_reward'
        ? ('elite_reward' as const)
        : ('loyalty_threshold' as const),
  };
  if (idemKey) {
    await saveLoyaltyIdempotentJson(
      supabase,
      user.id,
      idemKey,
      'voucher_redeem',
      loyaltyBody as unknown as Record<string, unknown>
    );
  }
  return NextResponse.json(loyaltyBody);
}
