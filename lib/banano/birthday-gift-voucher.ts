import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import type { MergedBirthdayConfig } from '@/lib/banano/banano-automation-defaults';
import { formatVoucherRewardLine, type VoucherRewardSnapshot } from '@/lib/banano/format-voucher-reward';
import { generateBananoVoucherPublicCode } from '@/lib/banano/loyalty-voucher-code';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

export type EnsureBirthdayGiftVoucherInput = {
  supabase: SupabaseClient;
  merchantUserId: string;
  memberId: string;
  /** Date calendaire de l’anniversaire (YYYY-MM-DD). */
  birthdayOccurrenceKey: string;
  cfg: MergedBirthdayConfig;
  pointsBalance: number;
  stampsBalance: number;
  loyaltyMode: 'points' | 'stamps';
  merchantLocale: string | null;
};

function rewardSnapshotFromBirthdayCfg(
  cfg: MergedBirthdayConfig,
  locale: string
): VoucherRewardSnapshot {
  const loc = normalizeAppLocale(locale);
  const t = createServerTranslator('Dashboard.bananoAutomationCompose', loc);
  const baseLabel = t('birthday_voucher_base_label');
  if (cfg.discount_kind === 'none') {
    return { reward_kind: 'label_only', reward_percent: null, reward_euro_cents: null, reward_label: baseLabel };
  }
  if (cfg.discount_kind === 'percent') {
    return {
      reward_kind: 'percent',
      reward_percent: cfg.discount_percent,
      reward_euro_cents: null,
      reward_label: baseLabel,
    };
  }
  return {
    reward_kind: 'fixed_euro',
    reward_percent: null,
    reward_euro_cents: cfg.discount_fixed_cents,
    reward_label: baseLabel,
  };
}

function expiresAtAfterOccurrence(occurrenceYmd: string): string {
  const [y, m, d] = occurrenceYmd.split('-').map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    const fallback = new Date();
    fallback.setUTCDate(fallback.getUTCDate() + 2);
    return fallback.toISOString();
  }
  return new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0)).toISOString();
}

/**
 * Crée le bon cadeau anniversaire si absent (idempotence par occurrence).
 */
export async function ensureBirthdayGiftVoucher(
  input: EnsureBirthdayGiftVoucherInput
): Promise<{ publicCode: string; created: boolean } | { error: string }> {
  const loc = normalizeAppLocale(input.merchantLocale ?? undefined);
  const snap = rewardSnapshotFromBirthdayCfg(input.cfg, loc);
  const rewardLine = formatVoucherRewardLine(snap, loc);

  const { data: existing } = await input.supabase
    .from('banano_loyalty_vouchers')
    .select('public_code')
    .eq('user_id', input.merchantUserId)
    .eq('member_id', input.memberId)
    .eq('voucher_class', 'birthday_gift')
    .eq('birthday_gift_occurrence_key', input.birthdayOccurrenceKey)
    .maybeSingle();

  if (existing && typeof (existing as { public_code?: string }).public_code === 'string') {
    return {
      publicCode: String((existing as { public_code: string }).public_code),
      created: false,
    };
  }

  const pts = Math.max(0, Math.floor(Number(input.pointsBalance ?? 0)));
  const sts = Math.max(0, Math.floor(Number(input.stampsBalance ?? 0)));
  const issuerUnit = input.loyaltyMode === 'stamps' ? ('stamps' as const) : ('points' as const);
  const balanceSnap = input.loyaltyMode === 'stamps' ? Math.max(1, sts) : Math.max(1, pts);

  const rp = snap.reward_kind === 'percent' ? Number(snap.reward_percent) : null;
  const row = {
    user_id: input.merchantUserId,
    member_id: input.memberId,
    public_code: generateBananoVoucherPublicCode(),
    status: 'available' as const,
    reward_kind: snap.reward_kind,
    reward_percent: rp,
    reward_euro_cents: snap.reward_euro_cents,
    reward_label: rewardLine.slice(0, 2000),
    threshold_snapshot: balanceSnap,
    points_balance_after: balanceSnap,
    issuer_unit: issuerUnit,
    voucher_class: 'birthday_gift' as const,
    birthday_gift_occurrence_key: input.birthdayOccurrenceKey,
    metadata: { kind: 'birthday_gift', occurrence: input.birthdayOccurrenceKey },
    earn_event_id: null as string | null,
    expires_at: expiresAtAfterOccurrence(input.birthdayOccurrenceKey),
  };

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = attempt === 0 ? row.public_code : generateBananoVoucherPublicCode();
    const { error: insErr } = await input.supabase
      .from('banano_loyalty_vouchers')
      .insert({ ...row, public_code: code });
    if (!insErr) {
      await input.supabase.from('banano_loyalty_events').insert({
        user_id: input.merchantUserId,
        member_id: input.memberId,
        event_type: 'voucher_issued',
        delta_points: 0,
        delta_stamps: 0,
        note: `Anniversaire ${input.birthdayOccurrenceKey} · ${code}`,
      });
      return { publicCode: code, created: true };
    }
    if ((insErr as { code?: string }).code === '23505') {
      const { data: race } = await input.supabase
        .from('banano_loyalty_vouchers')
        .select('public_code')
        .eq('user_id', input.merchantUserId)
        .eq('member_id', input.memberId)
        .eq('voucher_class', 'birthday_gift')
        .eq('birthday_gift_occurrence_key', input.birthdayOccurrenceKey)
        .maybeSingle();
      if (race && typeof (race as { public_code?: string }).public_code === 'string') {
        return { publicCode: String((race as { public_code: string }).public_code), created: false };
      }
    } else {
      console.error('[birthday-gift-voucher]', insErr.message);
      return { error: 'insert_failed' };
    }
  }
  return { error: 'insert_failed' };
}
