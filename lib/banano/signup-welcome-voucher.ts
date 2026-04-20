import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import type { BananoSignupWelcomeSettings } from '@/lib/banano/loyalty-profile';
import { formatVoucherRewardLine, type VoucherRewardSnapshot } from '@/lib/banano/format-voucher-reward';
import { generateBananoVoucherPublicCode } from '@/lib/banano/loyalty-voucher-code';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

/** Placeholder demandé pour debug / extension future. */
export const sendWelcomeVoucher = async () => {
  console.log('Welcome voucher placeholder active');
  return null;
};

export type EnsureSignupWelcomeVoucherInput = {
  supabase: SupabaseClient;
  merchantUserId: string;
  memberId: string;
  cfg: BananoSignupWelcomeSettings;
  pointsBalance: number;
  stampsBalance: number;
  loyaltyMode: 'points' | 'stamps';
  merchantLocale: string | null;
};

function rewardSnapshotFromSignupCfg(cfg: BananoSignupWelcomeSettings): VoucherRewardSnapshot {
  if (cfg.voucherRewardKind === 'label_only') {
    return {
      reward_kind: 'label_only',
      reward_percent: null,
      reward_euro_cents: null,
      reward_label: cfg.rewardLabel,
    };
  }
  if (cfg.voucherRewardKind === 'percent') {
    return {
      reward_kind: 'percent',
      reward_percent: cfg.voucherRewardPercent,
      reward_euro_cents: null,
      reward_label: cfg.rewardLabel,
    };
  }
  return {
    reward_kind: 'fixed_euro',
    reward_percent: null,
    reward_euro_cents: cfg.voucherRewardEuroCents,
    reward_label: cfg.rewardLabel,
  };
}

function expiresAtFromValidityDays(validityDays: number | null): string | null {
  if (validityDays == null || !Number.isFinite(validityDays) || validityDays < 1) {
    return null;
  }
  return new Date(Date.now() + Math.min(3650, Math.floor(validityDays)) * 86400000).toISOString();
}

/**
 * Émet le bon d’accueil à la création de fiche (caisse / Wallet) si activé dans les paramètres.
 */
export async function ensureSignupWelcomeVoucher(
  input: EnsureSignupWelcomeVoucherInput
): Promise<{ publicCode: string; created: boolean } | { error: string }> {
  if (!input.cfg.enabled) {
    return { publicCode: '', created: false };
  }

  const loc = normalizeAppLocale(input.merchantLocale ?? undefined);
  const snap = rewardSnapshotFromSignupCfg(input.cfg);
  const rewardLine = formatVoucherRewardLine(snap, loc);

  const { data: existing } = await input.supabase
    .from('banano_loyalty_vouchers')
    .select('public_code')
    .eq('user_id', input.merchantUserId)
    .eq('member_id', input.memberId)
    .eq('voucher_class', 'signup_welcome')
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
  const t = createServerTranslator('Dashboard.bananoAutomationCompose', loc);

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
    voucher_class: 'signup_welcome' as const,
    birthday_gift_occurrence_key: null as string | null,
    metadata: { kind: 'signup_welcome' },
    earn_event_id: null as string | null,
    expires_at: expiresAtFromValidityDays(input.cfg.validityDays),
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
        note: `${t('signup_welcome_voucher_base_label')} · ${code}`.slice(0, 500),
      });
      return { publicCode: code, created: true };
    }
    if ((insErr as { code?: string }).code === '23505') {
      const { data: race } = await input.supabase
        .from('banano_loyalty_vouchers')
        .select('public_code')
        .eq('user_id', input.merchantUserId)
        .eq('member_id', input.memberId)
        .eq('voucher_class', 'signup_welcome')
        .maybeSingle();
      if (race && typeof (race as { public_code?: string }).public_code === 'string') {
        return { publicCode: String((race as { public_code: string }).public_code), created: false };
      }
    } else {
      console.error('[signup-welcome-voucher]', insErr.message);
      return { error: 'insert_failed' };
    }
  }
  return { error: 'insert_failed' };
}
