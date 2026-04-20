/**
 * Synthèse « Expert-Comptable » : remises fidélité vs avantages collaborateurs (mois calendaire).
 */

import { format } from 'date-fns';
import { dateFnsLocaleForApp } from '@/lib/i18n/date-fns-locale';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatVoucherRewardLine } from '@/lib/banano/format-voucher-reward';

export type ComptaBananoLoyaltyLine = {
  at: string;
  code: string;
  memberName: string;
  rewardKind: string;
  euroValueCents: number | null;
  rewardLine: string;
};

export type ComptaBananoStaffLine = {
  at: string;
  memberName: string;
  amountCents: number;
  note: string | null;
};

export type ComptaBananoMonthlyPayload = {
  monthLabel: string;
  year: number;
  month: number;
  periodStartIso: string;
  periodEndExclusiveIso: string;
  loyalty: {
    totalFixedEuroCents: number;
    percentVoucherCount: number;
    labelOnlyVoucherCount: number;
    totalRedemptions: number;
    lines: ComptaBananoLoyaltyLine[];
  };
  staff: {
    totalDebitedCents: number;
    debitEventCount: number;
    lines: ComptaBananoStaffLine[];
  };
};

function memberLabel(m: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const d = (m.display_name ?? '').trim();
  if (d) return d;
  const a = [m.first_name, m.last_name].map((x) => (x ?? '').trim()).filter(Boolean);
  return a.length ? a.join(' ') : '—';
}

export function comptaBananoMonthRangeUtc(
  year: number,
  month: number,
  appLocale = 'fr'
): {
  startIso: string;
  endExclusiveIso: string;
  monthLabel: string;
} {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endExcl = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const loc = dateFnsLocaleForApp(appLocale);
  const lf = format(start, 'MMMM yyyy', { locale: loc });
  const monthLabel = lf ? lf.charAt(0).toUpperCase() + lf.slice(1) : format(start, 'yyyy-MM');
  return {
    startIso: start.toISOString(),
    endExclusiveIso: endExcl.toISOString(),
    monthLabel,
  };
}

export async function buildComptaBananoMonthlySummary(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: number,
  appLocale = 'fr'
): Promise<{ ok: true; data: ComptaBananoMonthlyPayload } | { ok: false; error: string }> {
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12 || year < 2020 || year > 2100) {
    return { ok: false, error: 'Période invalide.' };
  }

  const { startIso, endExclusiveIso, monthLabel } = comptaBananoMonthRangeUtc(year, month, appLocale);

  const { data: vouchersRaw, error: vErr } = await supabase
    .from('banano_loyalty_vouchers')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'redeemed')
    .gte('redeemed_at', startIso)
    .lt('redeemed_at', endExclusiveIso)
    .neq('voucher_class', 'staff_allowance')
    .order('redeemed_at', { ascending: true })
    .limit(8000);

  if (vErr) {
    return { ok: false, error: vErr.message };
  }

  const { data: debitsRaw, error: eErr } = await supabase
    .from('banano_loyalty_events')
    .select('created_at, member_id, amount_cents, note')
    .eq('user_id', userId)
    .eq('event_type', 'staff_allowance_debit')
    .gte('created_at', startIso)
    .lt('created_at', endExclusiveIso)
    .order('created_at', { ascending: true })
    .limit(8000);

  if (eErr) {
    return { ok: false, error: eErr.message };
  }

  const vouchers = vouchersRaw ?? [];
  const debits = debitsRaw ?? [];

  const memberIds = [
    ...new Set([
      ...vouchers.map((v) => v.member_id as string),
      ...debits.map((d) => d.member_id as string),
    ]),
  ];
  const memberMap = new Map<
    string,
    { display_name: string | null; first_name: string | null; last_name: string | null }
  >();

  if (memberIds.length > 0) {
    const { data: memRows, error: mErr } = await supabase
      .from('banano_loyalty_members')
      .select('id, display_name, first_name, last_name')
      .eq('user_id', userId)
      .in('id', memberIds);
    if (mErr) {
      return { ok: false, error: mErr.message };
    }
    for (const m of memRows ?? []) {
      const row = m as {
        id: string;
        display_name: string | null;
        first_name: string | null;
        last_name: string | null;
      };
      memberMap.set(row.id, {
        display_name: row.display_name,
        first_name: row.first_name,
        last_name: row.last_name,
      });
    }
  }

  let totalFixedEuroCents = 0;
  let percentVoucherCount = 0;
  let labelOnlyVoucherCount = 0;
  const loyaltyLines: ComptaBananoLoyaltyLine[] = [];

  for (const v of vouchers) {
    const rk = String(v.reward_kind ?? 'label_only');
    const rewardLine = formatVoucherRewardLine(
      {
        reward_kind: rk,
        reward_percent: v.reward_percent,
        reward_euro_cents: v.reward_euro_cents,
        reward_label: String(v.reward_label ?? ''),
      },
      appLocale
    );
    let euroValueCents: number | null = null;
    if (rk === 'fixed_euro') {
      const c = v.reward_euro_cents != null ? Math.max(0, Math.floor(Number(v.reward_euro_cents))) : 0;
      euroValueCents = c;
      totalFixedEuroCents += c;
    } else if (rk === 'percent') {
      percentVoucherCount += 1;
    } else {
      labelOnlyVoucherCount += 1;
    }

    loyaltyLines.push({
      at: String(v.redeemed_at ?? v.created_at ?? ''),
      code: String(v.public_code ?? ''),
      memberName: memberMap.get(v.member_id as string)
        ? memberLabel(memberMap.get(v.member_id as string)!)
        : '—',
      rewardKind: rk,
      euroValueCents,
      rewardLine,
    });
  }

  let totalDebitedCents = 0;
  const staffLines: ComptaBananoStaffLine[] = [];
  for (const d of debits) {
    const cents = Math.max(0, Math.floor(Number((d as { amount_cents?: number | null }).amount_cents ?? 0)));
    totalDebitedCents += cents;
    staffLines.push({
      at: String(d.created_at ?? ''),
      memberName: memberMap.get(d.member_id as string)
        ? memberLabel(memberMap.get(d.member_id as string)!)
        : '—',
      amountCents: cents,
      note: (d as { note?: string | null }).note ?? null,
    });
  }

  const data: ComptaBananoMonthlyPayload = {
    monthLabel,
    year,
    month,
    periodStartIso: startIso,
    periodEndExclusiveIso: endExclusiveIso,
    loyalty: {
      totalFixedEuroCents,
      percentVoucherCount,
      labelOnlyVoucherCount,
      totalRedemptions: vouchers.length,
      lines: loyaltyLines,
    },
    staff: {
      totalDebitedCents,
      debitEventCount: debits.length,
      lines: staffLines,
    },
  };

  return { ok: true, data };
}

export function comptaBananoMonthlyToCsv(payload: ComptaBananoMonthlyPayload): string {
  const esc = (s: string) => {
    const t = s.replace(/\r\n/g, '\n');
    if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
    return t;
  };
  const rows: string[] = [];
  rows.push('\uFEFFsection,timestamp,code_ou_ref,beneficiaire,detail,montant_centimes,montant_eur');
  const fmtEur = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
  for (const l of payload.loyalty.lines) {
    const cents = l.euroValueCents ?? '';
    rows.push(
      [
        'fidelite',
        esc(l.at),
        esc(l.code),
        esc(l.memberName),
        esc(l.rewardLine),
        cents === '' ? '' : String(cents),
        l.euroValueCents != null ? esc(fmtEur(l.euroValueCents)) : '',
      ].join(',')
    );
  }
  for (const l of payload.staff.lines) {
    rows.push(
      [
        'collaborateur',
        esc(l.at),
        '',
        esc(l.memberName),
        esc(l.note ?? ''),
        String(l.amountCents),
        esc(fmtEur(l.amountCents)),
      ].join(',')
    );
  }
  rows.push(
    [
      'synthese',
      '',
      '',
      '',
      esc('TOTAL remises fidélité (bons montant fixe)'),
      String(payload.loyalty.totalFixedEuroCents),
      esc(fmtEur(payload.loyalty.totalFixedEuroCents)),
    ].join(',')
  );
  rows.push(
    [
      'synthese',
      '',
      '',
      '',
      esc('TOTAL avantages collaborateurs (débits caisse REPUTEXA)'),
      String(payload.staff.totalDebitedCents),
      esc(fmtEur(payload.staff.totalDebitedCents)),
    ].join(',')
  );
  return rows.join('\r\n');
}
