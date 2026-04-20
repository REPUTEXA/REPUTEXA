import type { BananoLoyaltyBonusConfig } from '@/lib/banano/loyalty-bonus';

export type BananoVoucherRewardKind = 'label_only' | 'percent' | 'fixed_euro';

/** Paramètres du programme pour un mode (points ou tampons) — stockés séparément en base. */
export type LoyaltyProgramSideConfig = {
  threshold: number;
  rewardText: string;
  voucherRewardKind: BananoVoucherRewardKind;
  voucherRewardPercent: number;
  voucherRewardEuroCents: number;
  voucherValidityDays: number | null;
  voucherWhatsAppEnabled: boolean;
};

export type BananoStaffAllowanceSettings = {
  enabled: boolean;
  monthlyEuroCents: number;
  validityDays: number | null;
};

export type BananoEliteRewardSettings = {
  enabled: boolean;
  euroCents: number;
  /** Gabarit WhatsApp ; null ou vide = message par défaut (traduction Dashboard). */
  whatsappTemplate: string | null;
  validityDays: number | null;
};

/** Bon automatique à la création de la fiche (inscription Wallet / caisse). */
export type BananoSignupWelcomeSettings = {
  enabled: boolean;
  voucherRewardKind: BananoVoucherRewardKind;
  voucherRewardPercent: number;
  voucherRewardEuroCents: number;
  /** Libellé « produit offert » ou texte libre si kind = label_only. */
  rewardLabel: string;
  validityDays: number | null;
};

/** Champs fidélité Banano issus de `profiles` (l’API lit toujours la ligne à jour). */
export type BananoLoyaltyMerchantConfig = {
  /** Secret Bearer pour l'agent Reputexa Sync (ingestion caisse) ; null si non activé. */
  bananoPilotageIngestSecret: string | null;
  /** Mode actif caisse : les deux programmes restent configurés indépendamment. */
  mode: 'points' | 'stamps';
  pointsProgram: LoyaltyProgramSideConfig;
  stampsProgram: LoyaltyProgramSideConfig;
  pointsPerVisit: number;
  pointsPerEuro: number;
  stampsPerVisit: number;
  stampsPerEuro: number;
  bonus: BananoLoyaltyBonusConfig;
  staffAllowance: BananoStaffAllowanceSettings;
  eliteReward: BananoEliteRewardSettings;
  signupWelcome: BananoSignupWelcomeSettings;
};

export function activeLoyaltyProgram(cfg: BananoLoyaltyMerchantConfig): LoyaltyProgramSideConfig {
  return cfg.mode === 'points' ? cfg.pointsProgram : cfg.stampsProgram;
}

function parseBonus(row: Record<string, unknown>): BananoLoyaltyBonusConfig {
  const parseBonusEnabled = (v: unknown): boolean => {
    if (v === true || v === 1) return true;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return s === 'true' || s === 't' || s === '1' || s === 'yes';
    }
    return false;
  };
  const bonusEnabled = parseBonusEnabled(row?.banano_loyalty_bonus_enabled);
  const startRaw = row?.banano_loyalty_bonus_start_date;
  const endRaw = row?.banano_loyalty_bonus_end_date;
  const normDate = (v: unknown): string | null => {
    if (v == null || v === '') return null;
    if (typeof v === 'string') {
      const ymd = v.trim().slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
    }
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
      return v.toISOString().slice(0, 10);
    }
    return null;
  };
  const startDate = normDate(startRaw);
  const endDate = normDate(endRaw);
  const pointsExtraPerVisit = Math.max(
    0,
    Math.min(100_000, Math.floor(Number(row?.banano_loyalty_bonus_points_extra) || 0))
  );
  const stampsExtraPerVisit = Math.max(
    0,
    Math.min(10_000, Math.floor(Number(row?.banano_loyalty_bonus_stamps_extra) || 0))
  );
  const clampEuroBonus = (v: unknown): number => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(100_000, n);
  };
  const pointsExtraPerEuro = clampEuroBonus(row?.banano_loyalty_bonus_points_per_euro);
  const stampsExtraPerEuro = clampEuroBonus(row?.banano_loyalty_bonus_stamps_per_euro);
  return {
    enabled: bonusEnabled,
    startDate,
    endDate,
    pointsExtraPerVisit,
    stampsExtraPerVisit,
    pointsExtraPerEuro,
    stampsExtraPerEuro,
  };
}

function programSideFromRow(
  row: Record<string, unknown>,
  side: 'points' | 'stamps'
): LoyaltyProgramSideConfig {
  const thresholdCol = side === 'points' ? 'banano_loyalty_threshold' : 'banano_loyalty_threshold_stamps';
  const rewardCol = side === 'points' ? 'banano_loyalty_reward_text' : 'banano_loyalty_reward_text_stamps';
  const vk =
    side === 'points'
      ? 'banano_loyalty_voucher_reward_kind'
      : 'banano_loyalty_voucher_stamps_reward_kind';
  const vp =
    side === 'points'
      ? 'banano_loyalty_voucher_reward_percent'
      : 'banano_loyalty_voucher_stamps_reward_percent';
  const ve =
    side === 'points'
      ? 'banano_loyalty_voucher_reward_euro_cents'
      : 'banano_loyalty_voucher_stamps_reward_euro_cents';
  const vd =
    side === 'points'
      ? 'banano_loyalty_voucher_validity_days'
      : 'banano_loyalty_voucher_stamps_validity_days';
  const vw =
    side === 'points'
      ? 'banano_loyalty_voucher_whatsapp_enabled'
      : 'banano_loyalty_voucher_stamps_whatsapp_enabled';

  const threshold = Math.max(
    1,
    Math.min(1_000_000, Math.floor(Number(row?.[thresholdCol]) || 1))
  );
  const rewardRaw = row?.[rewardCol];
  const rewardText =
    typeof rewardRaw === 'string' && rewardRaw.trim().length > 0 ? rewardRaw.trim() : '10€ de remise';

  const vrRaw = row?.[vk];
  const voucherRewardKind: BananoVoucherRewardKind =
    vrRaw === 'percent' || vrRaw === 'fixed_euro' ? vrRaw : 'label_only';

  const voucherRewardPercent = Math.min(
    100,
    Math.max(
      0,
      (() => {
        const n = Number(row?.[vp]);
        return Number.isFinite(n) ? n : 0;
      })()
    )
  );

  const voucherRewardEuroCents = Math.max(
    0,
    Math.min(
      1_000_000_000,
      (() => {
        const n = Math.floor(Number(row?.[ve]));
        return Number.isFinite(n) ? n : 0;
      })()
    )
  );

  const vdRaw = row?.[vd];
  const voucherValidityDays =
    vdRaw == null || vdRaw === ''
      ? null
      : (() => {
          const n = Math.floor(Number(vdRaw));
          if (!Number.isFinite(n) || n < 1) return null;
          return Math.min(3650, n);
        })();

  const waRaw = row?.[vw];
  const voucherWhatsAppEnabled =
    waRaw === true ||
    waRaw === 1 ||
    (typeof waRaw === 'string' && waRaw.trim().toLowerCase() === 'true');

  return {
    threshold,
    rewardText,
    voucherRewardKind,
    voucherRewardPercent,
    voucherRewardEuroCents,
    voucherValidityDays,
    voucherWhatsAppEnabled,
  };
}

function staffAllowanceFromRow(row: Record<string, unknown>): BananoStaffAllowanceSettings {
  const en = row?.banano_staff_allowance_enabled;
  const enabled =
    en === true || en === 1 || (typeof en === 'string' && en.trim().toLowerCase() === 'true');
  const cents = Math.max(
    0,
    Math.min(100_000_000, Math.floor(Number(row?.banano_staff_allowance_monthly_euro_cents) || 0))
  );
  const vdRaw = row?.banano_staff_allowance_validity_days;
  const validityDays =
    vdRaw == null || vdRaw === ''
      ? null
      : (() => {
          const n = Math.floor(Number(vdRaw));
          if (!Number.isFinite(n) || n < 1) return null;
          return Math.min(3650, n);
        })();
  return { enabled, monthlyEuroCents: cents, validityDays };
}

export function signupWelcomeFromRow(row: Record<string, unknown>): BananoSignupWelcomeSettings {
  const en = row?.banano_signup_welcome_voucher_enabled;
  const enabled =
    en === true || en === 1 || (typeof en === 'string' && en.trim().toLowerCase() === 'true');
  const rkRaw = row?.banano_signup_welcome_reward_kind;
  const voucherRewardKind: BananoVoucherRewardKind =
    rkRaw === 'percent' || rkRaw === 'fixed_euro' ? rkRaw : 'label_only';
  const voucherRewardPercent = Math.min(
    100,
    Math.max(0, (() => {
      const n = Number(row?.banano_signup_welcome_reward_percent);
      return Number.isFinite(n) ? n : 0;
    })())
  );
  const voucherRewardEuroCents = Math.max(
    0,
    Math.min(
      1_000_000_000,
      (() => {
        const n = Math.floor(Number(row?.banano_signup_welcome_reward_euro_cents));
        return Number.isFinite(n) ? n : 0;
      })()
    )
  );
  const lblRaw = row?.banano_signup_welcome_reward_label;
  const rewardLabel = typeof lblRaw === 'string' ? lblRaw.trim().slice(0, 2000) : '';
  const vdRaw = row?.banano_signup_welcome_validity_days;
  const validityDays =
    vdRaw == null || vdRaw === ''
      ? null
      : (() => {
          const n = Math.floor(Number(vdRaw));
          if (!Number.isFinite(n) || n < 1) return null;
          return Math.min(3650, n);
        })();
  return {
    enabled,
    voucherRewardKind,
    voucherRewardPercent,
    voucherRewardEuroCents,
    rewardLabel,
    validityDays,
  };
}

export function eliteRewardFromRow(row: Record<string, unknown>): BananoEliteRewardSettings {
  const en = row?.banano_elite_reward_enabled;
  const enabled =
    en === true || en === 1 || (typeof en === 'string' && en.trim().toLowerCase() === 'true');
  const cents = Math.max(
    0,
    Math.min(100_000_000, Math.floor(Number(row?.banano_elite_reward_euro_cents) || 0))
  );
  const tplRaw = row?.banano_elite_reward_whatsapp_template;
  const whatsappTemplate =
    typeof tplRaw === 'string' && tplRaw.trim().length > 0 ? tplRaw.trim() : null;
  const vdRaw = row?.banano_elite_reward_validity_days;
  const validityDays =
    vdRaw == null || vdRaw === ''
      ? null
      : (() => {
          const n = Math.floor(Number(vdRaw));
          if (!Number.isFinite(n) || n < 1) return null;
          return Math.min(3650, n);
        })();
  return { enabled, euroCents: cents, whatsappTemplate, validityDays };
}

/**
 * Mappe une ligne `profiles` vers les réglages terminal.
 * Seuils ≥ 1 ; points et tampons par visite peuvent être 0 ; absents / invalides → défauts prudents.
 */
export function loyaltyConfigFromProfileRow(
  row: Record<string, unknown> | null | undefined
): BananoLoyaltyMerchantConfig {
  const pointsRaw = row?.banano_loyalty_points_per_visit;
  const pointsPerVisit = Math.max(
    0,
    Math.min(
      100_000,
      pointsRaw == null || pointsRaw === ''
        ? 1
        : (() => {
            const n = Math.floor(Number(pointsRaw));
            return Number.isFinite(n) ? n : 1;
          })()
    )
  );
  const stampsRaw = row?.banano_loyalty_stamps_per_visit;
  const stampsPerVisit = Math.max(
    0,
    Math.min(
      10_000,
      stampsRaw == null || stampsRaw === ''
        ? 1
        : (() => {
            const n = Math.floor(Number(stampsRaw));
            return Number.isFinite(n) ? n : 1;
          })()
    )
  );
  const mode = row?.banano_loyalty_mode === 'stamps' ? 'stamps' : 'points';

  const ppeRaw = row?.banano_loyalty_points_per_euro;
  const pointsPerEuro = Math.max(
    0,
    Math.min(
      100_000,
      ppeRaw == null || ppeRaw === ''
        ? 0
        : (() => {
            const n = Number(ppeRaw);
            return Number.isFinite(n) ? n : 0;
          })()
    )
  );

  const speRaw = row?.banano_loyalty_stamps_per_euro;
  const stampsPerEuro = Math.max(
    0,
    Math.min(
      100_000,
      speRaw == null || speRaw === ''
        ? 0
        : (() => {
            const n = Number(speRaw);
            return Number.isFinite(n) ? n : 0;
          })()
    )
  );

  const ingestRaw = row?.banano_pilotage_ingest_secret;
  const bananoPilotageIngestSecret =
    typeof ingestRaw === 'string' && ingestRaw.trim().length > 0 ? ingestRaw.trim() : null;

  return {
    bananoPilotageIngestSecret,
    mode,
    pointsProgram: programSideFromRow(row ?? {}, 'points'),
    stampsProgram: programSideFromRow(row ?? {}, 'stamps'),
    pointsPerVisit,
    pointsPerEuro,
    stampsPerVisit,
    stampsPerEuro,
    bonus: parseBonus(row ?? {}),
    staffAllowance: staffAllowanceFromRow(row ?? {}),
    eliteReward: eliteRewardFromRow(row ?? {}),
    signupWelcome: signupWelcomeFromRow(row ?? {}),
  };
}
