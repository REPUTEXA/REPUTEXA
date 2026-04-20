import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createClient } from '@/lib/supabase/server';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

type Ctx = { params: Promise<{ voucherId: string }> };

async function loadStaffVoucher(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  voucherId: string
) {
  const { data: row, error } = await supabase
    .from('banano_loyalty_vouchers')
    .select('*')
    .eq('id', voucherId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !row) return { errorKey: 'errors.crm_staffVoucherNotFound' as const };
  if (String((row as { voucher_class?: string }).voucher_class ?? '') !== 'staff_allowance') {
    return { errorKey: 'errors.crm_notStaffAllowanceVoucher' as const };
  }
  return { row };
}

function initialEuroCents(v: Record<string, unknown>): number {
  const init = (v as { initial_euro_cents?: number | null }).initial_euro_cents;
  if (typeof init === 'number' && init >= 0) return Math.floor(init);
  return Math.max(0, Math.floor(Number(v.threshold_snapshot) || 0));
}

type PatchBody = {
  remainingEuroCents?: number;
  /** ISO 8601 ou null = sans expiration */
  expiresAt?: string | null;
  status?: 'available' | 'expired' | 'redeemed';
};

function staffVoucherBalanceLabelEuro(cents: number, appLocale: string): string {
  const loc = normalizeAppLocale(appLocale);
  const intlByApp: Record<string, string> = {
    fr: 'fr-FR',
    en: 'en-US',
    'en-gb': 'en-GB',
    de: 'de-DE',
    es: 'es-ES',
    it: 'it-IT',
    pt: 'pt-PT',
    ja: 'ja-JP',
    zh: 'zh-CN',
  };
  const intl = intlByApp[loc] ?? 'fr-FR';
  const euros = cents / 100;
  const minFd = cents % 100 === 0 ? 0 : 2;
  return `${euros.toLocaleString(intl, { minimumFractionDigits: minFd, maximumFractionDigits: 2 })} €`;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const localeTag = apiLocaleFromRequest(req);
  const { voucherId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }
  if (!voucherId) {
    return apiJsonError(req, 'errors.crm_invalidId', 400);
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return apiJsonError(req, 'invalidJson', 400);
  }

  const got = await loadStaffVoucher(supabase, user.id, voucherId);
  if ('errorKey' in got) {
    return apiJsonError(req, got.errorKey ?? 'errors.crm_staffVoucherNotFound', 404);
  }
  const v = got.row as Record<string, unknown>;
  const memberId = v.member_id as string;
  const code = String(v.public_code ?? '');
  const initial = initialEuroCents(v);
  let rem = Math.floor(Number((v as { remaining_euro_cents?: number | null }).remaining_euro_cents ?? 0));
  if (body.remainingEuroCents !== undefined) {
    const n = Math.floor(Number(body.remainingEuroCents));
    if (!Number.isFinite(n) || n < 0 || n > initial) {
      return apiJsonError(req, 'errors.crm_staffVoucherBalanceRange', 400, {
        max: (initial / 100).toFixed(2),
      });
    }
    rem = n;
  }

  let expiresAt: string | null | undefined;
  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null || body.expiresAt === '') {
      expiresAt = null;
    } else {
      const t = new Date(body.expiresAt).getTime();
      if (!Number.isFinite(t)) {
        return apiJsonError(req, 'errors.crm_invalidExpiryDate', 400);
      }
      expiresAt = new Date(t).toISOString();
    }
  }

  let status: string | undefined;
  let redeemedAt: string | null | undefined;
  if (body.status !== undefined) {
    if (!['available', 'expired', 'redeemed'].includes(body.status)) {
      return apiJsonError(req, 'errors.crm_invalidVoucherStatus', 400);
    }
    status = body.status;
    if (status === 'redeemed') {
      rem = 0;
      redeemedAt = new Date().toISOString();
    } else {
      redeemedAt = null;
    }
  }

  const patch: Record<string, unknown> = {};
  if (body.remainingEuroCents !== undefined || body.status !== undefined) {
    patch.remaining_euro_cents = rem;
    patch.points_balance_after = rem;
  }
  if (expiresAt !== undefined) patch.expires_at = expiresAt;
  if (status !== undefined) {
    patch.status = status;
    patch.redeemed_at = redeemedAt;
  }

  if (Object.keys(patch).length === 0) {
    return apiJsonError(req, 'errors.crm_noFieldsToUpdate', 400);
  }

  const { data: updated, error: upErr } = await supabase
    .from('banano_loyalty_vouchers')
    .update(patch)
    .eq('id', voucherId)
    .eq('user_id', user.id)
    .select('*')
    .maybeSingle();

  if (upErr || !updated) {
    console.error('[staff-vouchers PATCH]', upErr?.message);
    return apiJsonError(req, 'errors.replyUpdateFailed', 500);
  }

  await supabase.from('banano_loyalty_events').insert({
    user_id: user.id,
    member_id: memberId,
    event_type: 'staff_allowance_merchant_adjust',
    delta_points: 0,
    delta_stamps: 0,
    note: tm('staffVoucherEventAdjust', {
      code,
      balance: staffVoucherBalanceLabelEuro(rem, localeTag),
    }),
  });

  return NextResponse.json({ ok: true, voucher: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(_req));
  const { voucherId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(_req, 'unauthorized', 401);
  }
  if (!voucherId) {
    return apiJsonError(_req, 'errors.crm_invalidId', 400);
  }

  const got = await loadStaffVoucher(supabase, user.id, voucherId);
  if ('errorKey' in got) {
    return apiJsonError(_req, got.errorKey ?? 'errors.crm_staffVoucherNotFound', 404);
  }
  const v = got.row as Record<string, unknown>;
  const memberId = v.member_id as string;
  const code = String(v.public_code ?? '');

  const { error: delErr } = await supabase
    .from('banano_loyalty_vouchers')
    .delete()
    .eq('id', voucherId)
    .eq('user_id', user.id);

  if (delErr) {
    console.error('[staff-vouchers DELETE]', delErr.message);
    return apiJsonError(_req, 'errors.crm_deleteFailed', 500);
  }

  await supabase.from('banano_loyalty_events').insert({
    user_id: user.id,
    member_id: memberId,
    event_type: 'staff_allowance_merchant_adjust',
    delta_points: 0,
    delta_stamps: 0,
    note: tm('staffVoucherEventDelete', { code }),
  });

  return NextResponse.json({ ok: true });
}
