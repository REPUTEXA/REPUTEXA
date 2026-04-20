import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { loyaltyConfigFromProfileRow } from '@/lib/banano/loyalty-profile';
import { BANANO_PROFILE_LOYALTY_COLUMNS } from '@/lib/banano/loyalty-profile-columns';

/** Lecture seule des réglages fidélité (dont bons collaborateurs) pour l’onglet Équipe. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const tm = createServerTranslator('ApiMerchant', apiLocaleFromRequest(req));
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return apiJsonError(req, 'unauthorized', 401);
  }

  const { data: row, error } = await supabase
    .from('profiles')
    .select(BANANO_PROFILE_LOYALTY_COLUMNS)
    .eq('id', user.id)
    .maybeSingle();

  if (error || !row) {
    console.error('[banano/loyalty/settings GET]', error?.message);
    return NextResponse.json({ error: tm('readFailed') }, { status: 500 });
  }

  const loyalty = loyaltyConfigFromProfileRow(row as unknown as Record<string, unknown>);
  return NextResponse.json({ loyalty });
}

type Body = Partial<{
  loyaltyMode: 'points' | 'stamps';
  /** Seuil programme points */
  threshold: number;
  rewardText: string;
  /** Seuil programme tampons (indépendant des points) */
  thresholdStamps: number;
  rewardTextStamps: string;
  pointsPerVisit: number;
  pointsPerEuro: number;
  stampsPerVisit: number;
  stampsPerEuro: number;
  bonusEnabled: boolean;
  bonusStartDate: string | null;
  bonusEndDate: string | null;
  bonusPointsExtra: number;
  bonusStampsExtra: number;
  bonusPointsPerEuro: number;
  bonusStampsPerEuro: number;
  voucherRewardKind: 'label_only' | 'percent' | 'fixed_euro';
  voucherRewardPercent: number;
  voucherRewardEuroCents: number;
  /** Jours de validité du bon après émission ; null ou 0 = sans limite. */
  voucherValidityDays: number | null;
  voucherWhatsAppEnabled: boolean;
  voucherStampsRewardKind: 'label_only' | 'percent' | 'fixed_euro';
  voucherStampsRewardPercent: number;
  voucherStampsRewardEuroCents: number;
  voucherStampsValidityDays: number | null;
  voucherStampsWhatsAppEnabled: boolean;
  staffAllowanceEnabled: boolean;
  staffAllowanceMonthlyEuroCents: number;
  staffAllowanceValidityDays: number | null;
  eliteRewardEnabled: boolean;
  eliteRewardEuroCents: number;
  eliteRewardWhatsAppTemplate: string | null;
  eliteRewardValidityDays: number | null;
  signupWelcomeEnabled: boolean;
  signupWelcomeRewardKind: 'label_only' | 'percent' | 'fixed_euro';
  signupWelcomeRewardPercent: number;
  signupWelcomeRewardEuroCents: number;
  signupWelcomeRewardLabel: string;
  signupWelcomeValidityDays: number | null;
  /** Activation unique : clé nanoid 32 (voir Paramètres fidélité). */
  pilotageIngestSecret?: string;
}>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const locale = apiLocaleFromRequest(req);
  const tSettings = createServerTranslator('LoyaltySettings', locale);
  const tm = createServerTranslator('ApiMerchant', locale);

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

  const patch: Record<string, string | number | boolean | null> = {};

  if (body.loyaltyMode !== undefined) {
    if (body.loyaltyMode !== 'points' && body.loyaltyMode !== 'stamps') {
      return NextResponse.json({ error: tSettings('modeInvalid') }, { status: 400 });
    }
    patch.banano_loyalty_mode = body.loyaltyMode;
  }

  if (body.threshold !== undefined) {
    const t = Math.floor(Number(body.threshold));
    if (!Number.isFinite(t) || t < 1 || t > 1_000_000) {
      return NextResponse.json({ error: tSettings('thresholdRange') }, { status: 400 });
    }
    patch.banano_loyalty_threshold = t;
  }

  if (body.rewardText !== undefined) {
    const s = String(body.rewardText ?? '').trim();
    if (s.length < 1 || s.length > 2000) {
      return NextResponse.json({ error: tSettings('rewardTextPointsLength') }, { status: 400 });
    }
    patch.banano_loyalty_reward_text = s;
  }

  if (body.thresholdStamps !== undefined) {
    const t = Math.floor(Number(body.thresholdStamps));
    if (!Number.isFinite(t) || t < 1 || t > 1_000_000) {
      return NextResponse.json({ error: tSettings('thresholdStampsRange') }, { status: 400 });
    }
    patch.banano_loyalty_threshold_stamps = t;
  }

  if (body.rewardTextStamps !== undefined) {
    const s = String(body.rewardTextStamps ?? '').trim();
    if (s.length < 1 || s.length > 2000) {
      return NextResponse.json({ error: tSettings('rewardTextStampsLength') }, { status: 400 });
    }
    patch.banano_loyalty_reward_text_stamps = s;
  }

  if (body.pointsPerVisit !== undefined) {
    const n = Math.floor(Number(body.pointsPerVisit));
    if (!Number.isFinite(n) || n < 0 || n > 100_000) {
      return NextResponse.json({ error: tSettings('pointsPerVisitRange') }, { status: 400 });
    }
    patch.banano_loyalty_points_per_visit = n;
  }

  if (body.pointsPerEuro !== undefined) {
    const n = Number(body.pointsPerEuro);
    if (!Number.isFinite(n) || n < 0 || n > 100_000) {
      return NextResponse.json({ error: tSettings('pointsPerEuroRange') }, { status: 400 });
    }
    if (n <= 0) {
      const effectiveMode =
        body.loyaltyMode ??
        (
          await supabase
            .from('profiles')
            .select('banano_loyalty_mode')
            .eq('id', user.id)
            .maybeSingle()
        ).data?.banano_loyalty_mode;
      if (effectiveMode === 'points') {
        return NextResponse.json({ error: tSettings('pointsModeEuroRateRequired') }, { status: 400 });
      }
    }
    patch.banano_loyalty_points_per_euro = n;
  }

  if (body.stampsPerVisit !== undefined) {
    const n = Math.floor(Number(body.stampsPerVisit));
    if (!Number.isFinite(n) || n < 0 || n > 10_000) {
      return NextResponse.json({ error: tSettings('stampsPerVisitRange') }, { status: 400 });
    }
    patch.banano_loyalty_stamps_per_visit = n;
  }

  if (body.stampsPerEuro !== undefined) {
    const n = Number(body.stampsPerEuro);
    if (!Number.isFinite(n) || n < 0 || n > 100_000) {
      return NextResponse.json({ error: tSettings('stampsPerEuroRange') }, { status: 400 });
    }
    patch.banano_loyalty_stamps_per_euro = n;
  }

  if (typeof body.bonusEnabled === 'boolean') {
    patch.banano_loyalty_bonus_enabled = body.bonusEnabled;
    if (!body.bonusEnabled) {
      patch.banano_loyalty_bonus_points_per_euro = 0;
      patch.banano_loyalty_bonus_stamps_per_euro = 0;
      patch.banano_loyalty_bonus_points_extra = 0;
      patch.banano_loyalty_bonus_stamps_extra = 0;
      patch.banano_loyalty_bonus_start_date = null;
      patch.banano_loyalty_bonus_end_date = null;
    } else if (body.bonusEnabled) {
      const s = body.bonusStartDate != null ? String(body.bonusStartDate).trim() : '';
      const e = body.bonusEndDate != null ? String(body.bonusEndDate).trim() : '';
      if (!DATE_RE.test(s) || !DATE_RE.test(e)) {
        return NextResponse.json({ error: tSettings('bonusPeriodDates') }, { status: 400 });
      }
      if (s > e) {
        return NextResponse.json({ error: tSettings('bonusEndAfterStart') }, { status: 400 });
      }
      const pEx = Math.floor(Number(body.bonusPointsExtra));
      const stEx = Math.floor(Number(body.bonusStampsExtra));
      const pExE = Number(body.bonusPointsPerEuro);
      const stExE = Number(body.bonusStampsPerEuro);
      if (!Number.isFinite(pEx) || pEx < 0 || pEx > 100_000) {
        return NextResponse.json({ error: tSettings('bonusPointsFlatRange') }, { status: 400 });
      }
      if (!Number.isFinite(stEx) || stEx < 0 || stEx > 10_000) {
        return NextResponse.json({ error: tSettings('bonusStampsFlatRange') }, { status: 400 });
      }
      if (!Number.isFinite(pExE) || pExE < 0 || pExE > 100_000) {
        return NextResponse.json({ error: tSettings('bonusPointsPerEuroRange') }, { status: 400 });
      }
      if (!Number.isFinite(stExE) || stExE < 0 || stExE > 100_000) {
        return NextResponse.json({ error: tSettings('bonusStampsPerEuroRange') }, { status: 400 });
      }

      let mode: 'points' | 'stamps' = 'points';
      if (body.loyaltyMode === 'stamps') mode = 'stamps';
      else if (body.loyaltyMode !== 'points') {
        const { data: row } = await supabase
          .from('profiles')
          .select('banano_loyalty_mode')
          .eq('id', user.id)
          .maybeSingle();
        mode = row?.banano_loyalty_mode === 'stamps' ? 'stamps' : 'points';
      }
      const okPoints = pExE > 0 || pEx >= 1;
      const okStamps = stExE > 0 || stEx >= 1;
      if (mode === 'points' && !okPoints) {
        return NextResponse.json({ error: tSettings('bonusPointsModeNeedSignal') }, { status: 400 });
      }
      if (mode === 'stamps' && !okStamps) {
        return NextResponse.json({ error: tSettings('bonusStampsModeNeedSignal') }, { status: 400 });
      }
      patch.banano_loyalty_bonus_start_date = s;
      patch.banano_loyalty_bonus_end_date = e;
      patch.banano_loyalty_bonus_points_extra = pEx;
      patch.banano_loyalty_bonus_stamps_extra = stEx;
      patch.banano_loyalty_bonus_points_per_euro = pExE;
      patch.banano_loyalty_bonus_stamps_per_euro = stExE;
    }
  }

  if (body.voucherRewardKind !== undefined) {
    if (
      body.voucherRewardKind !== 'label_only' &&
      body.voucherRewardKind !== 'percent' &&
      body.voucherRewardKind !== 'fixed_euro'
    ) {
      return NextResponse.json({ error: tSettings('voucherKindInvalid') }, { status: 400 });
    }
    patch.banano_loyalty_voucher_reward_kind = body.voucherRewardKind;
  }

  if (body.voucherRewardPercent !== undefined) {
    const n = Number(body.voucherRewardPercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json({ error: tSettings('voucherPercentRange') }, { status: 400 });
    }
    patch.banano_loyalty_voucher_reward_percent = n;
  }

  if (body.voucherRewardEuroCents !== undefined) {
    const n = Math.floor(Number(body.voucherRewardEuroCents));
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) {
      return NextResponse.json({ error: tSettings('voucherEuroCentsInvalid') }, { status: 400 });
    }
    patch.banano_loyalty_voucher_reward_euro_cents = n;
  }

  if (body.voucherValidityDays !== undefined) {
    if (body.voucherValidityDays === null) {
      patch.banano_loyalty_voucher_validity_days = null;
    } else {
      const n = Math.floor(Number(body.voucherValidityDays));
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: tSettings('validityDaysInvalid') }, { status: 400 });
      }
      if (n <= 0) {
        patch.banano_loyalty_voucher_validity_days = null;
      } else if (n > 3650) {
        return NextResponse.json({ error: tSettings('validityMaxDays') }, { status: 400 });
      } else {
        patch.banano_loyalty_voucher_validity_days = n;
      }
    }
  }

  if (typeof body.voucherWhatsAppEnabled === 'boolean') {
    patch.banano_loyalty_voucher_whatsapp_enabled = body.voucherWhatsAppEnabled;
  }

  if (body.voucherStampsRewardKind !== undefined) {
    if (
      body.voucherStampsRewardKind !== 'label_only' &&
      body.voucherStampsRewardKind !== 'percent' &&
      body.voucherStampsRewardKind !== 'fixed_euro'
    ) {
      return NextResponse.json({ error: tSettings('voucherStampsKindInvalid') }, { status: 400 });
    }
    patch.banano_loyalty_voucher_stamps_reward_kind = body.voucherStampsRewardKind;
  }

  if (body.voucherStampsRewardPercent !== undefined) {
    const n = Number(body.voucherStampsRewardPercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json({ error: tSettings('voucherStampsPercentRange') }, { status: 400 });
    }
    patch.banano_loyalty_voucher_stamps_reward_percent = n;
  }

  if (body.voucherStampsRewardEuroCents !== undefined) {
    const n = Math.floor(Number(body.voucherStampsRewardEuroCents));
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) {
      return NextResponse.json({ error: tSettings('voucherStampsEuroCentsInvalid') }, { status: 400 });
    }
    patch.banano_loyalty_voucher_stamps_reward_euro_cents = n;
  }

  if (body.voucherStampsValidityDays !== undefined) {
    if (body.voucherStampsValidityDays === null) {
      patch.banano_loyalty_voucher_stamps_validity_days = null;
    } else {
      const n = Math.floor(Number(body.voucherStampsValidityDays));
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: tSettings('voucherStampsValidityInvalid') }, { status: 400 });
      }
      if (n <= 0) {
        patch.banano_loyalty_voucher_stamps_validity_days = null;
      } else if (n > 3650) {
        return NextResponse.json({ error: tSettings('validityMaxDays') }, { status: 400 });
      } else {
        patch.banano_loyalty_voucher_stamps_validity_days = n;
      }
    }
  }

  if (typeof body.voucherStampsWhatsAppEnabled === 'boolean') {
    patch.banano_loyalty_voucher_stamps_whatsapp_enabled = body.voucherStampsWhatsAppEnabled;
  }

  if (typeof body.staffAllowanceEnabled === 'boolean') {
    patch.banano_staff_allowance_enabled = body.staffAllowanceEnabled;
  }

  if (body.staffAllowanceMonthlyEuroCents !== undefined) {
    const n = Math.floor(Number(body.staffAllowanceMonthlyEuroCents));
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
      return NextResponse.json({ error: tSettings('staffMonthlyCentsInvalid') }, { status: 400 });
    }
    patch.banano_staff_allowance_monthly_euro_cents = n;
  }

  if (body.staffAllowanceValidityDays !== undefined) {
    if (body.staffAllowanceValidityDays === null) {
      patch.banano_staff_allowance_validity_days = null;
    } else {
      const n = Math.floor(Number(body.staffAllowanceValidityDays));
      if (!Number.isFinite(n) || n < 1 || n > 3650) {
        return NextResponse.json({ error: tSettings('staffValidityDaysRange') }, { status: 400 });
      }
      patch.banano_staff_allowance_validity_days = n;
    }
  }

  if (typeof body.eliteRewardEnabled === 'boolean') {
    patch.banano_elite_reward_enabled = body.eliteRewardEnabled;
  }

  if (body.eliteRewardEuroCents !== undefined) {
    const n = Math.floor(Number(body.eliteRewardEuroCents));
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
      return NextResponse.json({ error: tSettings('eliteRewardEuroCentsInvalid') }, { status: 400 });
    }
    patch.banano_elite_reward_euro_cents = n;
  }

  if (body.eliteRewardWhatsAppTemplate !== undefined) {
    if (body.eliteRewardWhatsAppTemplate === null) {
      patch.banano_elite_reward_whatsapp_template = null;
    } else {
      const s = String(body.eliteRewardWhatsAppTemplate ?? '');
      if (s.length > 4000) {
        return NextResponse.json({ error: tSettings('eliteRewardTemplateLength') }, { status: 400 });
      }
      patch.banano_elite_reward_whatsapp_template = s.trim().length > 0 ? s.trim() : null;
    }
  }

  if (body.eliteRewardValidityDays !== undefined) {
    if (body.eliteRewardValidityDays === null) {
      patch.banano_elite_reward_validity_days = null;
    } else {
      const n = Math.floor(Number(body.eliteRewardValidityDays));
      if (!Number.isFinite(n) || n < 1 || n > 3650) {
        return NextResponse.json({ error: tSettings('eliteRewardValidityRange') }, { status: 400 });
      }
      patch.banano_elite_reward_validity_days = n;
    }
  }

  if (typeof body.signupWelcomeEnabled === 'boolean') {
    patch.banano_signup_welcome_voucher_enabled = body.signupWelcomeEnabled;
  }

  if (body.signupWelcomeRewardKind !== undefined) {
    if (
      body.signupWelcomeRewardKind !== 'label_only' &&
      body.signupWelcomeRewardKind !== 'percent' &&
      body.signupWelcomeRewardKind !== 'fixed_euro'
    ) {
      return NextResponse.json({ error: tSettings('signupWelcomeKindInvalid') }, { status: 400 });
    }
    patch.banano_signup_welcome_reward_kind = body.signupWelcomeRewardKind;
  }

  if (body.signupWelcomeRewardPercent !== undefined) {
    const n = Number(body.signupWelcomeRewardPercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json({ error: tSettings('signupWelcomePercentRange') }, { status: 400 });
    }
    patch.banano_signup_welcome_reward_percent = n;
  }

  if (body.signupWelcomeRewardEuroCents !== undefined) {
    const n = Math.floor(Number(body.signupWelcomeRewardEuroCents));
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) {
      return NextResponse.json({ error: tSettings('voucherEuroCentsInvalid') }, { status: 400 });
    }
    patch.banano_signup_welcome_reward_euro_cents = n;
  }

  if (body.signupWelcomeRewardLabel !== undefined) {
    const s = String(body.signupWelcomeRewardLabel ?? '').trim();
    if (s.length > 2000) {
      return NextResponse.json({ error: tSettings('signupWelcomeLabelLength') }, { status: 400 });
    }
    patch.banano_signup_welcome_reward_label = s;
  }

  if (body.signupWelcomeValidityDays !== undefined) {
    if (body.signupWelcomeValidityDays === null) {
      patch.banano_signup_welcome_validity_days = null;
    } else {
      const n = Math.floor(Number(body.signupWelcomeValidityDays));
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: tSettings('validityDaysInvalid') }, { status: 400 });
      }
      if (n <= 0) {
        patch.banano_signup_welcome_validity_days = null;
      } else if (n > 3650) {
        return NextResponse.json({ error: tSettings('validityMaxDays') }, { status: 400 });
      } else {
        patch.banano_signup_welcome_validity_days = n;
      }
    }
  }

  if (body.pilotageIngestSecret !== undefined) {
    const s = String(body.pilotageIngestSecret ?? '').trim();
    if (!/^[A-Za-z0-9_-]{32}$/.test(s)) {
      return NextResponse.json(
        { error: tSettings('pilotageIngestSecretInvalid') },
        { status: 400 }
      );
    }
    const { data: curRow, error: curErr } = await supabase
      .from('profiles')
      .select('banano_pilotage_ingest_secret')
      .eq('id', user.id)
      .maybeSingle();
    if (curErr) {
      console.error('[banano/loyalty/settings] pilotage ingest read', curErr.message);
      return NextResponse.json({ error: tSettings('saveFailed') }, { status: 500 });
    }
    const existing = (curRow as { banano_pilotage_ingest_secret?: string | null } | null)
      ?.banano_pilotage_ingest_secret;
    if (existing != null && String(existing).trim() !== '') {
      return NextResponse.json({ error: tSettings('pilotageIngestAlreadySet') }, { status: 409 });
    }
    patch.banano_pilotage_ingest_secret = s;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: tm('noUpdateFields') }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select(BANANO_PROFILE_LOYALTY_COLUMNS)
    .single();

  if (error || !updated) {
    console.error('[banano/loyalty/settings]', error?.message);
    return NextResponse.json({ error: tSettings('saveFailed') }, { status: 500 });
  }

  const loyalty = loyaltyConfigFromProfileRow(updated as unknown as Record<string, unknown>);

  return NextResponse.json({ ok: true, loyalty });
}
