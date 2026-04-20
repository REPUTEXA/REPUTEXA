import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoyaltyServerTranslator } from '@/lib/banano/assert-terminal-staff';
import { expireDueBananoVouchers } from '@/lib/banano/expire-loyalty-vouchers';
import { assertTerminalStaffActive } from '@/lib/banano/assert-terminal-staff';
import { formatLoyaltyEuroAmount } from '@/lib/banano/format-loyalty-currency';
import { formatVoucherRewardLine } from '@/lib/banano/format-voucher-reward';
import {
  parseLoyaltyIdempotencyKey,
  readLoyaltyIdempotentJson,
  saveLoyaltyIdempotentJson,
} from '@/lib/banano/loyalty-idempotency';
import { loyaltyProcessedByUserId } from '@/lib/banano/resolve-processed-by-user-id';

export type StaffUsageMode = 'require_full_ticket' | 'partial_max';

export type StaffAllowanceUsageSuccessBody = {
  ok: true;
  member: unknown;
  staffUsage: {
    debitEuroCents: number;
    remainingEuroCentsAfter: number;
  };
};

/**
 * Débit du budget collaborateur (bons `staff_allowance`) sans code VCHR — scan wallet REP- + ticket caisse.
 */
export async function executeStaffAllowanceUsage(
  supabase: SupabaseClient,
  merchantUserId: string,
  body: {
    memberId: string;
    ticketAmountCents: number;
    staffUsageMode: StaffUsageMode;
    staffId?: string | null;
    idempotencyKey?: string;
  },
  t: LoyaltyServerTranslator,
  merchantLocale: string
): Promise<
  | { ok: true; status: 200; body: StaffAllowanceUsageSuccessBody }
  | { ok: false; status: number; error: string }
> {
  const idemKey = parseLoyaltyIdempotencyKey(body.idempotencyKey);
  if (idemKey) {
    const cached = await readLoyaltyIdempotentJson(supabase, merchantUserId, idemKey);
    if (cached && cached.ok === true && 'member' in cached) {
      if (typeof (cached as { staffUsage?: unknown }).staffUsage === 'object') {
        return { ok: true, status: 200, body: cached as StaffAllowanceUsageSuccessBody };
      }
      return {
        ok: false,
        status: 409,
        error: t('errors.staffIdempotencyWrongOperation'),
      };
    }
  }

  const ticketRaw = Math.floor(Number(body.ticketAmountCents));
  if (!Number.isFinite(ticketRaw) || ticketRaw < 1) {
    return { ok: false, status: 400, error: t('errors.staffTicketAmountInvalid') };
  }

  const { data: member, error: memErr } = await supabase
    .from('banano_loyalty_members')
    .select('id, crm_role, receives_staff_allowance')
    .eq('id', body.memberId)
    .eq('user_id', merchantUserId)
    .maybeSingle();

  if (memErr || !member) {
    return { ok: false, status: 404, error: t('errors.staffMemberNotFound') };
  }

  const receives = Boolean((member as { receives_staff_allowance?: boolean }).receives_staff_allowance);
  const role = String((member as { crm_role?: string | null }).crm_role ?? '').trim();
  if (!receives || role !== 'staff') {
    return {
      ok: false,
      status: 403,
      error: t('errors.staffWalletNotEligible'),
    };
  }

  const staffCheck = await assertTerminalStaffActive(supabase, merchantUserId, body.staffId, t);
  if (!staffCheck.ok) {
    return { ok: false, status: 400, error: staffCheck.error };
  }

  const processedByUserIdForEvents = await loyaltyProcessedByUserId(
    supabase,
    merchantUserId,
    body.staffId
  );

  await expireDueBananoVouchers(supabase, merchantUserId);

  const { data: voucherRows, error: vListErr } = await supabase
    .from('banano_loyalty_vouchers')
    .select('*')
    .eq('user_id', merchantUserId)
    .eq('member_id', body.memberId)
    .eq('voucher_class', 'staff_allowance')
    .eq('status', 'available')
    .order('created_at', { ascending: true });

  if (vListErr) {
    console.error('[staff-allowance-usage list]', vListErr.message);
    return { ok: false, status: 500, error: t('errors.staffVouchersListFailed') };
  }

  const now = new Date();
  const rows = (voucherRows ?? []).filter((r) => {
    const rem = Math.floor(Number((r as { remaining_euro_cents?: number | null }).remaining_euro_cents ?? 0));
    if (!(rem > 0)) return false;
    const exp = (r as { expires_at?: string | null }).expires_at;
    if (typeof exp === 'string' && exp && new Date(exp).getTime() < now.getTime()) return false;
    return true;
  });

  const totalRemaining = rows.reduce(
    (s, r) => s + Math.floor(Number((r as { remaining_euro_cents?: number | null }).remaining_euro_cents ?? 0)),
    0
  );

  if (totalRemaining < 1) {
    return { ok: false, status: 400, error: t('errors.staffCreditExhausted') };
  }

  let debitTotal = ticketRaw;
  if (body.staffUsageMode === 'require_full_ticket') {
    if (ticketRaw > totalRemaining) {
      return {
        ok: false,
        status: 409,
        error: t('errors.staffInsufficientForFullTicket', {
          remaining: formatLoyaltyEuroAmount(totalRemaining / 100, merchantLocale),
          ticket: formatLoyaltyEuroAmount(ticketRaw / 100, merchantLocale),
        }),
      };
    }
  } else {
    debitTotal = Math.min(ticketRaw, totalRemaining);
    if (debitTotal < 1) {
      return { ok: false, status: 400, error: t('errors.staffNothingToDebit') };
    }
  }

  let left = debitTotal;
  const nowIso = new Date().toISOString();

  for (let guard = 0; guard < 32 && left > 0; guard++) {
    const { data: v, error: pickErr } = await supabase
      .from('banano_loyalty_vouchers')
      .select('*')
      .eq('user_id', merchantUserId)
      .eq('member_id', body.memberId)
      .eq('voucher_class', 'staff_allowance')
      .eq('status', 'available')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pickErr) {
      console.error('[staff-allowance-usage pick]', pickErr.message);
      return { ok: false, status: 500, error: t('errors.staffVoucherReadFailed') };
    }

    if (!v) {
      return {
        ok: false,
        status: 409,
        error: t('errors.staffDebitIncomplete'),
      };
    }

    const vid = String((v as { id: string }).id);
    const exp = (v as { expires_at?: string | null }).expires_at;
    if (typeof exp === 'string' && exp && new Date(exp).getTime() < Date.now()) {
      await supabase.from('banano_loyalty_vouchers').update({ status: 'expired' }).eq('id', vid);
      continue;
    }

    const remaining = Math.floor(
      Number((v as { remaining_euro_cents?: number | null }).remaining_euro_cents ?? 0)
    );
    if (remaining < 1) continue;

    const take = Math.min(left, remaining);
    const newRem = remaining - take;
    const fullySpent = newRem <= 0;
    const code = String((v as { public_code?: string }).public_code ?? '');

    const { data: updated, error: upErr } = await supabase
      .from('banano_loyalty_vouchers')
      .update({
        remaining_euro_cents: newRem,
        points_balance_after: newRem,
        status: fullySpent ? 'redeemed' : 'available',
        redeemed_at: fullySpent ? nowIso : null,
        redeemed_by_staff_id:
          fullySpent && body.staffId && typeof body.staffId === 'string' ? body.staffId : null,
      })
      .eq('id', vid)
      .eq('user_id', merchantUserId)
      .eq('status', 'available')
      .select('*')
      .maybeSingle();

    if (upErr || !updated) {
      return {
        ok: false,
        status: 409,
        error: t('errors.staffDebitConflict'),
      };
    }

    const debitEuros = take / 100;
    const remEuros = newRem / 100;
    const debitStr = formatLoyaltyEuroAmount(debitEuros, merchantLocale);
    const remStr = formatLoyaltyEuroAmount(remEuros, merchantLocale);

    const rewardLine = formatVoucherRewardLine(
      {
        reward_kind: String((v as { reward_kind?: string }).reward_kind ?? 'fixed_euro'),
        reward_percent: (v as { reward_percent?: number | null }).reward_percent ?? null,
        reward_euro_cents: (v as { reward_euro_cents?: number | null }).reward_euro_cents ?? null,
        reward_label: String((v as { reward_label?: string | null }).reward_label ?? ''),
      },
      merchantLocale
    );

    await supabase.from('banano_loyalty_events').insert({
      user_id: merchantUserId,
      member_id: body.memberId,
      event_type: 'staff_allowance_debit',
      delta_points: 0,
      delta_stamps: 0,
      note: t('internal.staffDebitLedgerNote', {
        code: code || vid.slice(0, 8),
        debit: debitStr,
        remaining: remStr,
        reward: rewardLine,
      }),
      staff_id: body.staffId && typeof body.staffId === 'string' ? body.staffId : null,
      amount_cents: take,
      processed_by_user_id: processedByUserIdForEvents,
    });

    left -= take;
  }

  if (left > 0) {
    return {
      ok: false,
      status: 409,
      error: t('errors.staffDebitConcurrency'),
    };
  }

  const remainingAfter = totalRemaining - debitTotal;

  const { data: refreshed } = await supabase
    .from('banano_loyalty_members')
    .select('*')
    .eq('id', body.memberId)
    .single();

  const responseBody: StaffAllowanceUsageSuccessBody = {
    ok: true,
    member: refreshed,
    staffUsage: {
      debitEuroCents: debitTotal,
      remainingEuroCentsAfter: remainingAfter,
    },
  };

  if (idemKey) {
    await saveLoyaltyIdempotentJson(
      supabase,
      merchantUserId,
      idemKey,
      'transact',
      responseBody as unknown as Record<string, unknown>
    );
  }

  return { ok: true, status: 200, body: responseBody };
}
