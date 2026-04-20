import type { SupabaseClient } from '@supabase/supabase-js';
import { createTranslator } from 'next-intl';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import { buildElitePromoWhatsAppBody } from '@/lib/banano/elite-promo-message';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateBananoVoucherPublicCode } from '@/lib/banano/loyalty-voucher-code';
import { signWalletLinkPayload } from '@/lib/banano/wallet-link-token';
import { getSiteUrl } from '@/lib/site-url';
import { getServerMessagesForLocale } from '@/lib/emails/server-locale-message-pack';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { eliteRewardFromRow } from '@/lib/banano/loyalty-profile';
import {
  applyEliteRewardWhatsAppTemplate,
  formatEliteRewardAmountEuros,
} from '@/lib/banano/elite-reward-template';

export const ELITE_PROMO_BUCKET = 'banano-elite-promo';
export const MAX_ELITE_OFFER_LEN = 4000;

export function eliteAudioPathForUser(userId: string, rawPath: string): boolean {
  const p = rawPath.trim();
  if (!p.startsWith(`${userId}/`)) return false;
  if (p.includes('..') || p.includes('//')) return false;
  return /^[a-zA-Z0-9._\-/]+$/.test(p) && p.length <= 512;
}

export async function signedUrlForEliteAudio(storagePath: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.storage.from(ELITE_PROMO_BUCKET).createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function voucherExpiresAtFromDays(days: number | null): string | null {
  if (days == null || days < 1) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export type ElitePromoDispatchInput = {
  supabase: SupabaseClient;
  merchantUserId: string;
  memberId: string;
  monthKey: string;
  offerText: string;
  audioStoragePath?: string | null;
};

export type ElitePromoDispatchResult =
  | { ok: true; messageId?: string; fullMessage: string }
  | { ok: false; error: string; status: number };

/**
 * Envoie une promo Elite (WhatsApp), journalise. Réutilisé par envoi unitaire et lot.
 */
export async function dispatchElitePromoWhatsApp(
  input: ElitePromoDispatchInput
): Promise<ElitePromoDispatchResult> {
  const offerText = input.offerText.trim();
  if (offerText.length < 1) {
    return { ok: false, error: 'offer_required', status: 400 };
  }
  if (offerText.length > MAX_ELITE_OFFER_LEN) {
    return { ok: false, error: 'offer_too_long', status: 400 };
  }

  const { data: member, error: memErr } = await input.supabase
    .from('banano_loyalty_members')
    .select('id, phone_e164, first_name, display_name, points_balance, stamps_balance')
    .eq('id', input.memberId)
    .eq('user_id', input.merchantUserId)
    .maybeSingle();

  if (memErr || !member) {
    return { ok: false, error: 'member_not_found', status: 404 };
  }

  const phone = String((member as { phone_e164: string }).phone_e164 ?? '').trim();
  if (phone.length < 8) {
    return { ok: false, error: 'phone_missing', status: 400 };
  }

  const { data: blacklisted } = await input.supabase
    .from('blacklist')
    .select('id')
    .eq('user_id', input.merchantUserId)
    .eq('phone', phone)
    .maybeSingle();

  if (blacklisted) {
    return { ok: false, error: 'phone_blacklisted', status: 403 };
  }

  const { data: prof } = await input.supabase
    .from('profiles')
    .select(
      'establishment_name, language, banano_loyalty_mode, banano_elite_reward_enabled, banano_elite_reward_euro_cents, banano_elite_reward_whatsapp_template, banano_elite_reward_validity_days'
    )
    .eq('id', input.merchantUserId)
    .maybeSingle();

  const establishmentName =
    ((prof as { establishment_name?: string } | null)?.establishment_name ?? '').trim() || '';
  const merchantLocale = (prof as { language?: string | null } | null)?.language ?? null;
  const loyaltyMode =
    (prof as { banano_loyalty_mode?: string | null } | null)?.banano_loyalty_mode === 'stamps'
      ? 'stamps'
      : 'points';

  const eliteCfg = eliteRewardFromRow((prof ?? {}) as Record<string, unknown>);
  const eliteRewardActive = eliteCfg.enabled && eliteCfg.euroCents > 0;

  let mediaUrls: string[] | undefined;
  let audioPathLogged: string | null = null;
  if (input.audioStoragePath?.trim()) {
    const p = input.audioStoragePath.trim();
    if (!eliteAudioPathForUser(input.merchantUserId, p)) {
      return { ok: false, error: 'invalid_audio_path', status: 400 };
    }
    const url = await signedUrlForEliteAudio(p);
    if (!url) {
      return { ok: false, error: 'audio_url_failed', status: 502 };
    }
    mediaUrls = [url];
    audioPathLogged = p;
  }

  const loc = normalizeAppLocale(merchantLocale ?? undefined);
  const messages = getServerMessagesForLocale(loc);
  const tDash = createTranslator({ locale: loc, messages, namespace: 'Dashboard' });

  let walletLink = '';
  let voucherCodeForTemplate = '';

  if (eliteRewardActive) {
    const secret = process.env.BANANO_WALLET_LINK_SECRET?.trim();
    if (!secret || secret.length < 24) {
      return { ok: false, error: 'elite_wallet_secret_missing', status: 503 };
    }

    const { data: existing } = await input.supabase
      .from('banano_loyalty_vouchers')
      .select('public_code')
      .eq('user_id', input.merchantUserId)
      .eq('member_id', input.memberId)
      .eq('voucher_class', 'elite_reward')
      .eq('elite_promo_month_key', input.monthKey)
      .maybeSingle();

    if (existing && typeof (existing as { public_code?: string }).public_code === 'string') {
      voucherCodeForTemplate = String((existing as { public_code: string }).public_code);
    } else {
      const ptsBal = Math.floor(
        Number((member as { points_balance?: number }).points_balance ?? 0) || 0
      );
      const stBal = Math.floor(
        Number((member as { stamps_balance?: number }).stamps_balance ?? 0) || 0
      );
      const snap =
        loyaltyMode === 'stamps' ? Math.max(1, stBal) : Math.max(1, ptsBal);
      const issuerUnit = loyaltyMode === 'stamps' ? ('stamps' as const) : ('points' as const);
      const rewardCents = eliteCfg.euroCents;
      const eurosLabel = formatEliteRewardAmountEuros(rewardCents, merchantLocale);
      const rewardLabel = `Elite Top Clients ${input.monthKey} — ${eurosLabel}`.slice(0, 2000);
      const expiresAt = voucherExpiresAtFromDays(eliteCfg.validityDays);
      const meta = { ranking_month: input.monthKey };

      let inserted = false;
      for (let attempt = 0; attempt < 10 && !inserted; attempt++) {
        const publicCode = generateBananoVoucherPublicCode();
        const row = {
          user_id: input.merchantUserId,
          member_id: input.memberId,
          public_code: publicCode,
          status: 'available' as const,
          reward_kind: 'fixed_euro' as const,
          reward_percent: null as number | null,
          reward_euro_cents: rewardCents,
          reward_label: rewardLabel,
          threshold_snapshot: snap,
          points_balance_after: snap,
          issuer_unit: issuerUnit,
          voucher_class: 'elite_reward' as const,
          elite_promo_month_key: input.monthKey,
          metadata: meta,
          earn_event_id: null as string | null,
          expires_at: expiresAt,
        };
        const { error: insErr } = await input.supabase.from('banano_loyalty_vouchers').insert(row);
        if (!insErr) {
          inserted = true;
          voucherCodeForTemplate = publicCode;
          await input.supabase.from('banano_loyalty_events').insert({
            user_id: input.merchantUserId,
            member_id: input.memberId,
            event_type: 'voucher_issued',
            delta_points: 0,
            delta_stamps: 0,
            note: `Elite ${input.monthKey} · ${publicCode}`,
          });
        } else if ((insErr as { code?: string }).code === '23505') {
          const { data: race } = await input.supabase
            .from('banano_loyalty_vouchers')
            .select('public_code')
            .eq('user_id', input.merchantUserId)
            .eq('member_id', input.memberId)
            .eq('voucher_class', 'elite_reward')
            .eq('elite_promo_month_key', input.monthKey)
            .maybeSingle();
          if (race && typeof (race as { public_code?: string }).public_code === 'string') {
            voucherCodeForTemplate = String((race as { public_code: string }).public_code);
            inserted = true;
          }
        } else {
          console.error('[elite-promo voucher]', insErr.message);
          return { ok: false, error: 'elite_voucher_failed', status: 500 };
        }
      }
      if (!inserted) {
        return { ok: false, error: 'elite_voucher_failed', status: 500 };
      }
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
    const token = signWalletLinkPayload(
      { m: input.memberId, u: input.merchantUserId, exp },
      secret
    );
    const base = getSiteUrl().replace(/\/+$/, '');
    walletLink = `${base}/api/banano/wallet/smart-add?t=${encodeURIComponent(token)}`;
  }

  const rewardAmountFormatted = eliteRewardActive
    ? formatEliteRewardAmountEuros(eliteCfg.euroCents, merchantLocale)
    : '';

  const first =
    ((member as { first_name?: string | null }).first_name ?? '').trim() ||
    String((member as { display_name?: string }).display_name ?? '')
      .trim()
      .split(/\s+/)[0] ||
    tDash('bananoEliteClients.fallbackFirstName');
  const commerce =
    establishmentName.trim() || tDash('bananoEliteClients.fallbackEstablishment');

  let fullMessage: string;

  if (eliteRewardActive && walletLink) {
    const tpl = eliteCfg.whatsappTemplate;
    if (tpl && tpl.length > 0) {
      const vars: Record<string, string> = {
        customer_name: first,
        reward_amount: rewardAmountFormatted,
        wallet_link: walletLink,
        offer_text: offerText,
        establishment_name: commerce,
        voucher_code: voucherCodeForTemplate,
        month_key: input.monthKey,
      };
      fullMessage = applyEliteRewardWhatsAppTemplate(tpl, vars).trim();
      if (fullMessage.length < 1) {
        fullMessage = buildElitePromoWhatsAppBody({
          locale: merchantLocale,
          establishmentName,
          memberFirstName: (member as { first_name?: string | null }).first_name ?? null,
          memberDisplayName: String((member as { display_name?: string }).display_name ?? ''),
          monthKey: input.monthKey,
          offerText,
        });
      }
    } else {
      fullMessage = buildElitePromoWhatsAppBody({
        locale: merchantLocale,
        establishmentName,
        memberFirstName: (member as { first_name?: string | null }).first_name ?? null,
        memberDisplayName: String((member as { display_name?: string }).display_name ?? ''),
        monthKey: input.monthKey,
        offerText,
      });
    }
    if (!fullMessage.includes(walletLink)) {
      const footer = tDash('bananoEliteClients.promoWalletFooter', { wallet_link: walletLink });
      fullMessage = `${fullMessage.trim()}\n\n${footer}`.trim();
    }
  } else {
    fullMessage = buildElitePromoWhatsAppBody({
      locale: merchantLocale,
      establishmentName,
      memberFirstName: (member as { first_name?: string | null }).first_name ?? null,
      memberDisplayName: String((member as { display_name?: string }).display_name ?? ''),
      monthKey: input.monthKey,
      offerText,
    });
  }

  const bodyForTwilio = fullMessage.trim().length > 0 ? fullMessage : ' ';
  const res = await sendWhatsAppMessage(phone, bodyForTwilio, mediaUrls);
  if (!res.success) {
    return { ok: false, error: 'whatsapp_failed', status: 502 };
  }

  const { error: logErr } = await input.supabase.from('banano_loyalty_elite_promo_log').insert({
    user_id: input.merchantUserId,
    member_id: input.memberId,
    month_key: input.monthKey,
    offer_text: offerText,
    full_message: fullMessage,
    whatsapp_message_id: res.messageId ?? null,
    audio_storage_path: audioPathLogged,
  });

  if (logErr) {
    console.error('[elite-promo log]', logErr.message);
  }

  return { ok: true, messageId: res.messageId, fullMessage };
}
