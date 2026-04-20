import type { SupabaseClient } from '@supabase/supabase-js';
import { activeLoyaltyProgram, loyaltyConfigFromProfileRow } from '@/lib/banano/loyalty-profile';
import {
  effectiveEarnCredit,
  isBonusPerEuroStackingActive,
  isLoyaltyBonusCreditingNow,
} from '@/lib/banano/loyalty-bonus';
import { assertTerminalStaffActive } from '@/lib/banano/assert-terminal-staff';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import {
  buildWelcomeBackWhatsAppBody,
  welcomeBackMinDays,
  welcomeBackWhatsAppEnabled,
} from '@/lib/banano/generate-loyalty-whatsapp-narrative';
import { localeFromProfileRow, getMerchantLocaleForUserId } from '@/lib/i18n/merchant-locale';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { BANANO_PROFILE_LOYALTY_COLUMNS } from '@/lib/banano/loyalty-profile-columns';
import { generateBananoVoucherPublicCode } from '@/lib/banano/loyalty-voucher-code';
import { formatVoucherRewardLine } from '@/lib/banano/format-voucher-reward';
import { buildVoucherIssuedWhatsAppBody } from '@/lib/banano/build-voucher-whatsapp-body';
import {
  parseLoyaltyIdempotencyKey,
  readLoyaltyIdempotentJson,
  saveLoyaltyIdempotentJson,
} from '@/lib/banano/loyalty-idempotency';
import { executeStaffAllowanceUsage } from '@/lib/banano/staff-allowance-usage-execute';
import { loyaltyProcessedByUserId } from '@/lib/banano/resolve-processed-by-user-id';

export type BananoLoyaltyTransactBody = {
  memberId: string;
  kind: 'earn_visit' | 'redeem_reward' | 'redeem_points' | 'staff_usage';
  amount?: number;
  note?: string;
  ticketAmountCents?: number;
  ticketItemsCount?: number;
  staffId?: string | null;
  /** Caisse (même identifiant que l’agent sync) pour réconciliation tickets / Wallet. */
  terminalId?: string | null;
  idempotencyKey?: string;
  /** Débit staff : couverture totale du ticket ou plafonné au solde restant. */
  staffUsageMode?: 'require_full_ticket' | 'partial_max';
};

export type BananoLoyaltyVoucherIssuedPayload = {
  code: string;
  rewardLine: string;
  pointsBalanceAfter: number;
};

export type BananoLoyaltyTransactSuccessBody = {
  ok: true;
  member: unknown;
  vouchersIssued?: BananoLoyaltyVoucherIssuedPayload[];
  staffUsage?: {
    debitEuroCents: number;
    remainingEuroCentsAfter: number;
  };
};

function voucherExpiresAtIso(cfgValidityDays: number | null): string | null {
  if (cfgValidityDays == null || cfgValidityDays < 1) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + cfgValidityDays);
  return d.toISOString();
}

function isTransactSuccessBody(x: Record<string, unknown>): x is BananoLoyaltyTransactSuccessBody {
  return x.ok === true && 'member' in x;
}

/**
 * Cœur métier `/api/banano/loyalty/transact` — utilisable avec la session commerçant
 * ou la clé service (Agent Ghost) après résolution sécurisée du commerçant.
 */
export async function executeBananoLoyaltyTransact(
  supabase: SupabaseClient,
  merchantUserId: string,
  body: BananoLoyaltyTransactBody
): Promise<
  | { ok: true; status: 200; body: BananoLoyaltyTransactSuccessBody }
  | { ok: false; status: number; error: string }
> {
  let merchantLocale = await getMerchantLocaleForUserId(supabase, merchantUserId);
  let t = createServerTranslator('Loyalty', merchantLocale);

  if (body.kind === 'staff_usage') {
    const mode = body.staffUsageMode === 'partial_max' ? 'partial_max' : 'require_full_ticket';
    return executeStaffAllowanceUsage(
      supabase,
      merchantUserId,
      {
        memberId: body.memberId,
        ticketAmountCents: body.ticketAmountCents ?? 0,
        staffUsageMode: mode,
        staffId: body.staffId,
        idempotencyKey: body.idempotencyKey,
      },
      t,
      merchantLocale
    );
  }

  const idemKey = parseLoyaltyIdempotencyKey(body.idempotencyKey);
  if (idemKey) {
    const cached = await readLoyaltyIdempotentJson(supabase, merchantUserId, idemKey);
    if (cached && isTransactSuccessBody(cached)) {
      if (typeof (cached as { staffUsage?: unknown }).staffUsage === 'object') {
        return {
          ok: false,
          status: 409,
          error: t('errors.idempotencyKeyStaffDebitMismatch'),
        };
      }
      return { ok: true, status: 200, body: cached };
    }
  }

  if (!body.memberId || typeof body.memberId !== 'string') {
    return { ok: false, status: 400, error: t('errors.memberIdRequired') };
  }

  const { data: profileRow, error: profErr } = await supabase
    .from('profiles')
    .select(`${BANANO_PROFILE_LOYALTY_COLUMNS}, language`)
    .eq('id', merchantUserId)
    .maybeSingle();

  if (profErr || !profileRow) {
    return { ok: false, status: 500, error: t('errors.profileNotFound') };
  }

  merchantLocale = localeFromProfileRow((profileRow as { language?: string | null }).language);
  t = createServerTranslator('Loyalty', merchantLocale);

  const cfg = loyaltyConfigFromProfileRow(profileRow as unknown as Record<string, unknown>);
  const prog = activeLoyaltyProgram(cfg);

  const { data: member, error: memErr } = await supabase
    .from('banano_loyalty_members')
    .select('*')
    .eq('id', body.memberId)
    .eq('user_id', merchantUserId)
    .maybeSingle();

  if (memErr || !member) {
    return { ok: false, status: 404, error: t('errors.memberNotFound') };
  }

  const prevLastVisitAt = (member.last_visit_at as string | null | undefined) ?? null;
  const visitsBeforeCredit = Math.max(
    0,
    Math.floor(Number((member as { lifetime_visit_count?: number | null }).lifetime_visit_count ?? 0))
  );

  const staffCheck = await assertTerminalStaffActive(supabase, merchantUserId, body.staffId, t);
  if (!staffCheck.ok) {
    return { ok: false, status: 400, error: staffCheck.error };
  }

  const processedByUserIdForEvents = await loyaltyProcessedByUserId(supabase, merchantUserId, body.staffId);

  let earnedFromTicketPoints = 0;
  let deltaPoints = 0;
  let deltaStamps = 0;
  let eventType:
    | 'earn_points'
    | 'redeem_points'
    | 'earn_stamps'
    | 'redeem_stamps'
    | 'encaisser_reward' = 'earn_points';

  let voucherRemainders: number[] = [];
  let earnedStampsFromVisit = 0;

  if (body.kind === 'earn_visit') {
    if (cfg.mode === 'points') {
      const ppe = cfg.pointsPerEuro;
      if (!Number.isFinite(ppe) || ppe <= 0) {
        return {
          ok: false,
          status: 400,
          error: t('errors.pointsProgramRateNotConfigured'),
        };
      }
      const centsRaw = body.ticketAmountCents != null ? Math.floor(Number(body.ticketAmountCents)) : NaN;
      if (!Number.isFinite(centsRaw) || centsRaw <= 0) {
        return {
          ok: false,
          status: 400,
          error: t('errors.ticketAmountRequiredForPoints'),
        };
      }
      const euros = centsRaw / 100;
      const bonusNow = isLoyaltyBonusCreditingNow(cfg.bonus);
      const addPerEuro = bonusNow ? Math.max(0, cfg.bonus.pointsExtraPerEuro) : 0;
      const legacyFlat =
        bonusNow && addPerEuro <= 0 ? Math.max(0, cfg.bonus.pointsExtraPerVisit) : 0;
      const effPpe = ppe + addPerEuro;
      earnedFromTicketPoints = Math.ceil(euros * effPpe) + legacyFlat;
      eventType = 'earn_points';

      let b = member.points_balance + earnedFromTicketPoints;
      const T = prog.threshold;
      voucherRemainders = [];
      while (b >= T) {
        b -= T;
        voucherRemainders.push(b);
      }
      deltaPoints = b - member.points_balance;
    } else {
      const spe = cfg.stampsPerEuro;
      if (Number.isFinite(spe) && spe > 0) {
        const centsRaw = body.ticketAmountCents != null ? Math.floor(Number(body.ticketAmountCents)) : NaN;
        if (!Number.isFinite(centsRaw) || centsRaw <= 0) {
          return {
            ok: false,
            status: 400,
            error: t('errors.ticketAmountRequiredForStamps'),
          };
        }
        const euros = centsRaw / 100;
        const bonusEuroStack = isBonusPerEuroStackingActive(cfg.bonus, 'stamps');
        const addPerEuro = bonusEuroStack ? Math.max(0, Number(cfg.bonus.stampsExtraPerEuro) || 0) : 0;
        const bonusCampaign = isLoyaltyBonusCreditingNow(cfg.bonus);
        const legacyFlat =
          bonusCampaign && addPerEuro <= 0 ? Math.max(0, cfg.bonus.stampsExtraPerVisit) : 0;
        const effSpe = spe + Math.max(0, addPerEuro);
        const fromSpend = Math.ceil(euros * effSpe);
        const flat = Math.max(0, Math.min(10_000, Math.floor(Number(cfg.stampsPerVisit) || 0)));
        earnedStampsFromVisit = fromSpend + flat + legacyFlat;
      } else {
        const earn = effectiveEarnCredit({
          mode: cfg.mode,
          pointsPerVisit: cfg.pointsPerVisit,
          stampsPerVisit: cfg.stampsPerVisit,
          bonus: cfg.bonus,
        });
        earnedStampsFromVisit = earn.stamps;
      }
      eventType = 'earn_stamps';

      let b = member.stamps_balance + earnedStampsFromVisit;
      const T = prog.threshold;
      voucherRemainders = [];
      while (b >= T) {
        b -= T;
        voucherRemainders.push(b);
      }
      deltaStamps = b - member.stamps_balance;
    }
  } else if (body.kind === 'redeem_reward') {
    if (cfg.mode === 'points') {
      return {
        ok: false,
        status: 400,
        error: t('errors.redeemRewardUseDigitalVoucherPoints'),
      };
    }
    return {
      ok: false,
      status: 400,
      error: t('errors.redeemRewardUseDigitalVoucherStamps'),
    };
  } else if (body.kind === 'redeem_points') {
    if (cfg.mode !== 'points') {
      return { ok: false, status: 400, error: t('errors.partialRedeemPointsOnly') };
    }
    const amt = typeof body.amount === 'number' ? Math.floor(body.amount) : 0;
    if (amt < 1) {
      return { ok: false, status: 400, error: t('errors.invalidPointsAmount') };
    }
    if (member.points_balance < amt) {
      return { ok: false, status: 400, error: t('errors.insufficientPointsBalance') };
    }
    deltaPoints = -amt;
    eventType = 'redeem_points';
  } else {
    return { ok: false, status: 400, error: t('errors.invalidTransactKind') };
  }

  const newPoints = member.points_balance + deltaPoints;
  const newStamps = member.stamps_balance + deltaStamps;
  if (newPoints < 0 || newStamps < 0) {
    return { ok: false, status: 400, error: t('errors.inconsistentBalance') };
  }

  const { error: upErr } = await supabase
    .from('banano_loyalty_members')
    .update({
      points_balance: newPoints,
      stamps_balance: newStamps,
    })
    .eq('id', member.id);

  if (upErr) {
    console.error('[banano/transact update]', upErr.message);
    return { ok: false, status: 500, error: t('errors.balanceUpdateFailed') };
  }

  let amountCents: number | null = null;
  if (body.kind === 'earn_visit' && body.ticketAmountCents != null) {
    const raw = Math.floor(Number(body.ticketAmountCents));
    if (Number.isFinite(raw) && raw > 0 && raw <= 10_000_000) {
      amountCents = raw;
    }
  }

  const insertRow: Record<string, unknown> = {
    user_id: merchantUserId,
    member_id: member.id,
    event_type: eventType,
    delta_points:
      body.kind === 'earn_visit' && cfg.mode === 'points' ? earnedFromTicketPoints : deltaPoints,
    delta_stamps:
      body.kind === 'earn_visit' && cfg.mode === 'stamps' ? earnedStampsFromVisit : deltaStamps,
    note: (body.note ?? '').slice(0, 500) || null,
  };
  if (amountCents != null) insertRow.amount_cents = amountCents;
  if (body.kind === 'earn_visit' && body.ticketItemsCount != null) {
    const ic = Math.floor(Number(body.ticketItemsCount));
    if (Number.isFinite(ic) && ic > 0 && ic <= 100000) {
      insertRow.items_count = ic;
    }
  }
  if (body.staffId && typeof body.staffId === 'string') insertRow.staff_id = body.staffId;

  if (body.terminalId != null && typeof body.terminalId === 'string') {
    const tid = body.terminalId.trim().slice(0, 64);
    if (tid) insertRow.terminal_id = tid;
  }

  if (processedByUserIdForEvents) insertRow.processed_by_user_id = processedByUserIdForEvents;

  const { data: earnEventRow, error: evErr } = await supabase
    .from('banano_loyalty_events')
    .insert(insertRow)
    .select('id')
    .maybeSingle();

  if (evErr) {
    console.error('[banano/transact event]', evErr.message);
  }

  const earnEventId =
    earnEventRow && typeof (earnEventRow as { id?: string }).id === 'string'
      ? (earnEventRow as { id: string }).id
      : null;

  const vouchersIssued: BananoLoyaltyVoucherIssuedPayload[] = [];
  const rewardSnap = {
    reward_kind: prog.voucherRewardKind,
    reward_percent: prog.voucherRewardKind === 'percent' ? prog.voucherRewardPercent : null,
    reward_euro_cents: prog.voucherRewardKind === 'fixed_euro' ? prog.voucherRewardEuroCents : null,
    reward_label: prog.rewardText,
  };
  const rewardLineForMsg = formatVoucherRewardLine(
    {
      reward_kind: rewardSnap.reward_kind,
      reward_percent: rewardSnap.reward_percent,
      reward_euro_cents: rewardSnap.reward_euro_cents,
      reward_label: rewardSnap.reward_label,
    },
    merchantLocale
  );
  const expiresAtIso = voucherExpiresAtIso(prog.voucherValidityDays);

  if (
    !evErr &&
    body.kind === 'earn_visit' &&
    (cfg.mode === 'points' || cfg.mode === 'stamps') &&
    voucherRemainders.length > 0 &&
    earnEventId
  ) {
    const issuerUnit = cfg.mode === 'stamps' ? 'stamps' : 'points';
    for (const remainder of voucherRemainders) {
      let inserted = false;
      for (let attempt = 0; attempt < 10 && !inserted; attempt++) {
        const publicCode = generateBananoVoucherPublicCode();
        const row = {
          user_id: merchantUserId,
          member_id: member.id,
          public_code: publicCode,
          status: 'available' as const,
          reward_kind: prog.voucherRewardKind,
          reward_percent: rewardSnap.reward_percent,
          reward_euro_cents: rewardSnap.reward_euro_cents,
          reward_label: prog.rewardText.slice(0, 2000),
          threshold_snapshot: prog.threshold,
          points_balance_after: remainder,
          issuer_unit: issuerUnit,
          earn_event_id: earnEventId,
          expires_at: expiresAtIso,
        };
        const { error: vErr } = await supabase.from('banano_loyalty_vouchers').insert(row);
        if (!vErr) {
          inserted = true;
          vouchersIssued.push({
            code: publicCode,
            rewardLine: rewardLineForMsg,
            pointsBalanceAfter: remainder,
          });
          const voucherEv: Record<string, unknown> = {
            user_id: merchantUserId,
            member_id: member.id,
            event_type: 'voucher_issued',
            delta_points: cfg.mode === 'points' ? -prog.threshold : 0,
            delta_stamps: cfg.mode === 'stamps' ? -prog.threshold : 0,
            note: t('internal.voucherLedgerNote', { code: publicCode }),
            staff_id: body.staffId && typeof body.staffId === 'string' ? body.staffId : null,
            processed_by_user_id: processedByUserIdForEvents,
          };
          if (insertRow.terminal_id) voucherEv.terminal_id = insertRow.terminal_id;
          await supabase.from('banano_loyalty_events').insert(voucherEv);
        } else if (vErr.code !== '23505') {
          console.error('[banano/transact voucher]', vErr.message);
          break;
        }
      }
    }

    if (prog.voucherWhatsAppEnabled && vouchersIssued.length > 0) {
      const phone = String((member as { phone_e164?: string }).phone_e164 ?? '').trim();
      if (phone.length >= 8) {
        void (async () => {
          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('establishment_name')
              .eq('id', merchantUserId)
              .maybeSingle();
            const commerceName =
              ((prof as { establishment_name?: string } | null)?.establishment_name ?? '').trim() ||
              t('defaults.establishmentFallback');
            const lastRemainder =
              vouchersIssued[vouchersIssued.length - 1]?.pointsBalanceAfter ??
              (cfg.mode === 'stamps' ? newStamps : newPoints);
            const msg = buildVoucherIssuedWhatsAppBody({
              commerceName,
              codes: vouchersIssued.map((v) => v.code),
              rewardLine: rewardLineForMsg,
              threshold: prog.threshold,
              pointsBalanceAfter: lastRemainder,
              expiresAtIso: expiresAtIso,
              issuerUnit: cfg.mode === 'stamps' ? 'stamps' : 'points',
              locale: merchantLocale,
            });
            await sendWhatsAppMessage(phone, msg);
          } catch (e) {
            console.warn('[banano/transact voucher whatsapp]', e);
          }
        })();
      }
    }
  }

  const { data: refreshed } = await supabase
    .from('banano_loyalty_members')
    .select('*')
    .eq('id', member.id)
    .single();

  if (
    !evErr &&
    body.kind === 'earn_visit' &&
    welcomeBackWhatsAppEnabled() &&
    prevLastVisitAt &&
    visitsBeforeCredit >= 1
  ) {
    const gapDays = Math.floor(
      (Date.now() - new Date(prevLastVisitAt).getTime()) / 86400000
    );
    if (gapDays >= welcomeBackMinDays()) {
      const phone = String((member as { phone_e164?: string }).phone_e164 ?? '').trim();
      if (phone.length >= 8) {
        const memberId = String((member as { id: string }).id);
        void (async () => {
          try {
            const cooldownIso = new Date(Date.now() - 30 * 86400000).toISOString();
            const { data: recent } = await supabase
              .from('banano_loyalty_automation_log')
              .select('id')
              .eq('user_id', merchantUserId)
              .eq('member_id', memberId)
              .eq('rule_type', 'welcome_back')
              .gte('created_at', cooldownIso)
              .limit(1);
            if (recent?.length) return;

            const { data: prof } = await supabase
              .from('profiles')
              .select('establishment_name, language')
              .eq('id', merchantUserId)
              .maybeSingle();
            const merchantLocaleWelcome = localeFromProfileRow(
              (prof as { language?: string | null } | null)?.language
            );
            const commerceName =
              ((prof as { establishment_name?: string } | null)?.establishment_name ?? '').trim() ||
              '';
            const memRow = member as { first_name?: string; display_name?: string };
            const prenom =
              (memRow.first_name || memRow.display_name || '').trim().split(/\s+/)[0] ?? '';

            const msg = await buildWelcomeBackWhatsAppBody({
              commerceName,
              prenom,
              daysSinceLastVisit: gapDays,
              lifetimeVisitsBefore: visitsBeforeCredit,
              locale: merchantLocaleWelcome,
            });
            const res = await sendWhatsAppMessage(phone, msg);
            await supabase.from('banano_loyalty_automation_log').insert({
              user_id: merchantUserId,
              member_id: memberId,
              rule_type: 'welcome_back',
              channel: 'whatsapp',
              status: res.success ? 'sent' : 'failed',
              payload: {
                error: res.error ?? null,
                messageId: res.messageId ?? null,
                message_body: msg,
                establishment: commerceName,
                source: 'terminal_earn_visit',
                days_since_last_visit: gapDays,
              },
              estimated_revenue_cents: 0,
            });
          } catch (e) {
            console.warn('[banano/transact welcome_back]', e);
          }
        })();
      }
    }
  }

  const responseBody: BananoLoyaltyTransactSuccessBody = {
    ok: true,
    member: refreshed,
    vouchersIssued: vouchersIssued.length > 0 ? vouchersIssued : undefined,
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
