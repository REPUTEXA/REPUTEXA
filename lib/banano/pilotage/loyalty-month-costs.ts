import type { SupabaseClient } from '@supabase/supabase-js';

export type LoyaltyVoucherClassCostRow = {
  voucherClass: string;
  redeemedCount: number;
  fixedEuroRedeemedCents: number;
  nonFixedRedeemedCount: number;
};

/** Agrégat des remises utilisées en caisse, par équipier ayant encaissé (PIN terminal). */
export type LoyaltyStaffRedemptionCostRow = {
  staffId: string | null;
  staffDisplayName: string;
  voucherRedeemCount: number;
  fixedEuroFromVoucherRedeemsCents: number;
  nonFixedVoucherRedeemCount: number;
  /** Débits « bon collaborateur » enregistrés sur le mois (peuvent être partiels). */
  staffAllowanceDebitCents: number;
};

export type LoyaltyMonthCostBreakdown = {
  redeemedByClass: LoyaltyVoucherClassCostRow[];
  totalFixedEuroRedeemedCents: number;
  signupVouchersIssuedInMonth: number;
  signupIssuedFixedEuroCents: number;
  signupIssuedPercentCount: number;
  signupIssuedLabelOnlyCount: number;
  /** Source : `redeemed_by_staff_id` sur les bons + débits `staff_allowance_debit`. */
  fixedRedemptionsByStaff: LoyaltyStaffRedemptionCostRow[];
};

const CLASS_LABEL_ORDER = [
  'signup_welcome',
  'loyalty_threshold',
  'birthday_gift',
  'elite_reward',
  'staff_allowance',
];

function sortClasses(rows: LoyaltyVoucherClassCostRow[]): LoyaltyVoucherClassCostRow[] {
  return [...rows].sort((a, b) => {
    const ia = CLASS_LABEL_ORDER.indexOf(a.voucherClass);
    const ib = CLASS_LABEL_ORDER.indexOf(b.voucherClass);
    const sa = ia === -1 ? 99 : ia;
    const sb = ib === -1 ? 99 : ib;
    if (sa !== sb) return sa - sb;
    return a.voucherClass.localeCompare(b.voucherClass);
  });
}

function staffKey(id: string | null | undefined): string {
  return id && String(id).length > 0 ? String(id) : '__none__';
}

/**
 * Coûts fidélité sur une fenêtre calendaire (UTC ISO) : bons utilisés + bons d'accueil émis + ventilation équipiers.
 */
export async function fetchLoyaltyMonthCostBreakdown(
  supabase: SupabaseClient,
  userId: string,
  fromIso: string,
  toExclusiveIso: string
): Promise<LoyaltyMonthCostBreakdown> {
  const { data: redeemed } = await supabase
    .from('banano_loyalty_vouchers')
    .select('voucher_class, reward_kind, reward_euro_cents, redeemed_by_staff_id')
    .eq('user_id', userId)
    .eq('status', 'redeemed')
    .gte('redeemed_at', fromIso)
    .lt('redeemed_at', toExclusiveIso);

  const byClass = new Map<
    string,
    { redeemedCount: number; fixedEuro: number; nonFixed: number }
  >();

  const byStaff = new Map<
    string,
    {
      staffId: string | null;
      voucherRedeemCount: number;
      fixedEuro: number;
      nonFixed: number;
      staffAllowanceDebitCents: number;
    }
  >();

  const ensureStaff = (sid: string | null) => {
    const k = staffKey(sid);
    if (!byStaff.has(k)) {
      byStaff.set(k, {
        staffId: sid,
        voucherRedeemCount: 0,
        fixedEuro: 0,
        nonFixed: 0,
        staffAllowanceDebitCents: 0,
      });
    }
    return byStaff.get(k)!;
  };

  for (const raw of redeemed ?? []) {
    const r = raw as {
      voucher_class?: string;
      reward_kind?: string;
      reward_euro_cents?: number | null;
      redeemed_by_staff_id?: string | null;
    };
    const vc = String(r.voucher_class ?? 'loyalty_threshold');
    const rk = String(r.reward_kind ?? '');
    const cents = Math.max(0, Math.floor(Number(r.reward_euro_cents ?? 0)));
    const cur = byClass.get(vc) ?? { redeemedCount: 0, fixedEuro: 0, nonFixed: 0 };
    cur.redeemedCount += 1;
    if (rk === 'fixed_euro' && cents > 0) {
      cur.fixedEuro += cents;
    } else {
      cur.nonFixed += 1;
    }
    byClass.set(vc, cur);

    if (vc === 'staff_allowance') {
      continue;
    }

    const sid =
      r.redeemed_by_staff_id != null && String(r.redeemed_by_staff_id).length > 0
        ? String(r.redeemed_by_staff_id)
        : null;
    const st = ensureStaff(sid);
    st.voucherRedeemCount += 1;
    if (rk === 'fixed_euro' && cents > 0) {
      st.fixedEuro += cents;
    } else {
      st.nonFixed += 1;
    }
  }

  const { data: allowanceDebits } = await supabase
    .from('banano_loyalty_events')
    .select('staff_id, amount_cents')
    .eq('user_id', userId)
    .eq('event_type', 'staff_allowance_debit')
    .gte('created_at', fromIso)
    .lt('created_at', toExclusiveIso);

  for (const raw of allowanceDebits ?? []) {
    const r = raw as { staff_id?: string | null; amount_cents?: number | null };
    const debit = Math.max(0, Math.floor(Number(r.amount_cents ?? 0)));
    if (debit < 1) continue;
    const sid =
      r.staff_id != null && String(r.staff_id).length > 0 ? String(r.staff_id) : null;
    const st = ensureStaff(sid);
    st.staffAllowanceDebitCents += debit;
  }

  const redeemedByClass = sortClasses(
    [...byClass.entries()].map(([voucherClass, v]) => ({
      voucherClass,
      redeemedCount: v.redeemedCount,
      fixedEuroRedeemedCents: v.fixedEuro,
      nonFixedRedeemedCount: v.nonFixed,
    }))
  );

  const totalFixedEuroRedeemedCents = redeemedByClass.reduce(
    (s, r) => s + r.fixedEuroRedeemedCents,
    0
  );

  const { data: issuedSignup } = await supabase
    .from('banano_loyalty_vouchers')
    .select('reward_kind, reward_euro_cents')
    .eq('user_id', userId)
    .eq('voucher_class', 'signup_welcome')
    .gte('created_at', fromIso)
    .lt('created_at', toExclusiveIso);

  let signupIssuedFixedEuroCents = 0;
  let signupIssuedPercentCount = 0;
  let signupIssuedLabelOnlyCount = 0;
  for (const raw of issuedSignup ?? []) {
    const r = raw as { reward_kind?: string; reward_euro_cents?: number | null };
    const rk = String(r.reward_kind ?? '');
    const cents = Math.max(0, Math.floor(Number(r.reward_euro_cents ?? 0)));
    if (rk === 'fixed_euro' && cents > 0) signupIssuedFixedEuroCents += cents;
    else if (rk === 'percent') signupIssuedPercentCount += 1;
    else signupIssuedLabelOnlyCount += 1;
  }

  const staffIds = [...byStaff.values()]
    .map((v) => v.staffId)
    .filter((id): id is string => id != null && id.length > 0);

  const nameById = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: staffRows } = await supabase
      .from('banano_terminal_staff')
      .select('id, display_name')
      .eq('user_id', userId)
      .in('id', [...new Set(staffIds)]);
    for (const s of staffRows ?? []) {
      const row = s as { id?: string; display_name?: string | null };
      if (row.id) {
        nameById.set(String(row.id), String(row.display_name ?? '').trim() || '—');
      }
    }
  }

  const noneLabel = '—';
  const fixedRedemptionsByStaff: LoyaltyStaffRedemptionCostRow[] = [...byStaff.entries()]
    .map(([, v]) => {
      const label =
        v.staffId == null
          ? noneLabel
          : nameById.get(v.staffId) ?? `ID ${v.staffId.slice(0, 8)}…`;
      return {
        staffId: v.staffId,
        staffDisplayName: label,
        voucherRedeemCount: v.voucherRedeemCount,
        fixedEuroFromVoucherRedeemsCents: v.fixedEuro,
        nonFixedVoucherRedeemCount: v.nonFixed,
        staffAllowanceDebitCents: v.staffAllowanceDebitCents,
      };
    })
    .filter(
      (r) =>
        r.voucherRedeemCount > 0 ||
        r.fixedEuroFromVoucherRedeemsCents > 0 ||
        r.nonFixedVoucherRedeemCount > 0 ||
        r.staffAllowanceDebitCents > 0
    )
    .sort(
      (a, b) =>
        b.fixedEuroFromVoucherRedeemsCents +
        b.staffAllowanceDebitCents -
        (a.fixedEuroFromVoucherRedeemsCents + a.staffAllowanceDebitCents)
    );

  return {
    redeemedByClass,
    totalFixedEuroRedeemedCents,
    signupVouchersIssuedInMonth: (issuedSignup ?? []).length,
    signupIssuedFixedEuroCents,
    signupIssuedPercentCount,
    signupIssuedLabelOnlyCount,
    fixedRedemptionsByStaff,
  };
}
