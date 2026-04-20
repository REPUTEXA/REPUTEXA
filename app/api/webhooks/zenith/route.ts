import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { apiLocaleFromRequest } from '@/lib/api/api-locale-from-request';
import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizePhone } from '@/lib/zenith-capture/can-contact';
import {
  hasShipmentStatusField,
  parseWhatsappConsent,
  resolveShipmentStatus,
  resolveTrackingNumber,
  strategyToMinutes,
} from '@/lib/webhooks/ecommerce-ingest';
import { logWebhookConsentRejected } from '@/lib/webhooks/consent-reject-log';
import {
  CATEGORY_DELAYS,
  computeScheduledAt,
  getCallerIp,
} from '@/lib/webhooks/scheduling';
import { safeIngestPosQueueEvent } from '@/lib/omni-synapse';
import { SOLICITATION_COOLDOWN_REASON, solicitationCooldownCutoffIso } from '@/lib/zenith-capture/policy';

// ── Types ─────────────────────────────────────────────────────────────────────

type ZenithWebhookPayload = {
  first_name: string;
  phone: string;
  source_info?: string;
  last_purchase?: string;   // Nom du dernier achat/service (ex: "Soin Kératine")
  /** E-commerce : Delivered, Shipped, etc. */
  status?: string;
  tracking_number?: string;
  whatsapp_consent?: boolean;
  consent?: boolean;
};

type ReviewQueueInsert = {
  user_id: string;
  first_name: string;
  phone: string;
  source_info: string | null;
  status: 'pending';
  scheduled_at: string;
  metadata: {
    caller_ip: string;
    raw_phone: string;
    source_info: string | null;
    last_purchase: string | null;
    received_at: string;
    target_minutes: number;
    final_minutes: number;
    zenith_message_type: 'review';
    /** Aligné sur `api/webhooks/[api_key]` pour le journal commerçant. */
    ingress: 'zenith_token';
    shipment_status?: string;
    tracking_number?: string | null;
    ecommerce_post_delivery?: boolean;
    ecommerce_hybrid_test?: boolean;
  };
};

// ── Route ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/zenith
 *
 * Webhook d'entrée des données clients depuis un POS (Zelty, Lightspeed, Zapier…).
 * Authentifié par le header `x-reputexa-token` (token unique par commerçant Zenith).
 *
 * Payload JSON attendu :
 *   {
 *     "first_name": "Jean",
 *     "phone": "+33612345678",
 *     "source_info": "Zelty / Caisse Centrale",    // optionnel
 *     "last_purchase": "Soin Kératine"             // optionnel — personnalise l'étape 2
 *   }
 *
 * Logique :
 *   1. Authentification par token → résolution du user_id commerçant
 *   2. Vérification blacklist RGPD
 *   3. Insertion dans review_queue avec scheduled_at = now + 30 min
 *   4. IP de l'appelant stockée dans metadata (traçabilité RGPD)
 */
export async function POST(request: Request) {
  const locale = apiLocaleFromRequest(request);
  const t = createServerTranslator('Api', locale);

  // ── 1. Vérification du header d'authentification ──────────────────────────
  const token = request.headers.get('x-reputexa-token')?.trim();
  if (!token) {
    return apiJsonError(request, 'errors.webhookZenithTokenHeaderMissing', 401);
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error('[webhooks/zenith] Supabase admin client non configuré');
    return apiJsonError(request, 'serviceUnavailable', 503);
  }

  // ── 2. Résolution du commerçant via webhook_token ─────────────────────────
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select(
      'id, subscription_plan, selected_plan, webhook_send_delay_minutes, business_category, ecommerce_delivery_strategy, ecommerce_post_delivery_custom_minutes, legal_compliance_accepted'
    )
    .eq('webhook_token', token)
    .maybeSingle();

  if (profileError) {
    console.error('[webhooks/zenith] profiles lookup:', profileError.message);
    return apiJsonError(request, 'errors.webhookTokenLookupFailed', 500);
  }

  if (!profile?.id) {
    return apiJsonError(request, 'errors.webhookZenithTokenInvalid', 401);
  }

  if (!(profile as { legal_compliance_accepted?: boolean }).legal_compliance_accepted) {
    return apiJsonError(request, 'errors.webhookLegalCompliance', 403);
  }

  const userId = profile.id as string;

  // ── 3. Parse et validation du body JSON ──────────────────────────────────
  let body: Partial<ZenithWebhookPayload>;
  try {
    body = (await request.json()) as Partial<ZenithWebhookPayload>;
  } catch {
    return apiJsonError(request, 'errors.invalidJsonBody', 400);
  }

  const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : '';
  const phoneRaw  = typeof body.phone === 'string' ? body.phone.trim() : '';
  const sourceInfo =
    typeof body.source_info === 'string' && body.source_info.trim()
      ? body.source_info.trim()
      : null;
  const lastPurchase =
    typeof body.last_purchase === 'string' && body.last_purchase.trim()
      ? body.last_purchase.trim()
      : null;

  const bodyUnknown = body as Record<string, unknown>;
  const category = ((profile.business_category as string | null) ?? 'custom') as string;
  const ecommerceShipmentSignal =
    category === 'ecommerce' && hasShipmentStatusField(bodyUnknown);

  if (!firstName) {
    return apiJsonError(request, 'errors.webhookFirstNameRequired', 400);
  }
  if (!phoneRaw) {
    return apiJsonError(request, 'errors.webhookPhoneRequired', 400);
  }

  // Normalisation E.164 compatible (ex: 0612345678 → 33612345678)
  const phone = normalizePhone(phoneRaw);

  // ── 4. Vérification blacklist RGPD ────────────────────────────────────────
  const { data: blacklisted, error: blacklistError } = await admin
    .from('blacklist')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', phone)
    .maybeSingle();

  if (blacklistError) {
    console.error('[webhooks/zenith] blacklist check:', blacklistError.message);
    return apiJsonError(request, 'serverError', 500);
  }

  if (blacklisted) {
    // On répond 200 pour ne pas exposer qu'un numéro est blacklisté
    return NextResponse.json({ ok: true, queued: false, reason: 'blacklist' });
  }

  // ── 4b. E-commerce : consentement WhatsApp — toujours requis
  if (category === 'ecommerce') {
    const consent = parseWhatsappConsent(bodyUnknown);
    if (consent === 'no') {
      logWebhookConsentRejected('zenith', { user_id: userId, consent: 'false' });
      return NextResponse.json({ ok: true, queued: false, reason: 'consent_denied' });
    }
    if (consent === 'missing') {
      logWebhookConsentRejected('zenith', { user_id: userId, consent: 'missing' });
      return NextResponse.json({
        ok: true,
        queued: false,
        reason: 'consent_required',
        hint: t('webhookHint_whatsappConsent'),
      });
    }
  }

  // ── 4c. E-commerce + statut d’expédition présent : file uniquement après Livré
  if (ecommerceShipmentSignal) {
    const shipment = resolveShipmentStatus(bodyUnknown);
    if (shipment === 'shipped') {
      return NextResponse.json({
        ok: true,
        queued: false,
        reason: 'awaiting_delivery',
        hint: t('webhookHint_shippedAwaitingDelivered'),
      });
    }
    if (shipment !== 'delivered') {
      return NextResponse.json({
        ok: true,
        queued: false,
        reason: 'awaiting_delivery',
        hint: 'Le compte à rebours démarre uniquement lorsque status = Delivered / Livré.',
      });
    }
  }

  // ── 5. Cooldown resollicitation — review_queue ────────────────────────────
  const cooldownSince = solicitationCooldownCutoffIso();
  const { data: recentEntry } = await admin
    .from('review_queue')
    .select('id, sent_at')
    .eq('user_id', userId)
    .eq('phone', phone)
    .eq('status', 'sent')
    .gte('sent_at', cooldownSince)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentEntry) {
    return NextResponse.json({
      ok: true,
      queued: false,
      reason: SOLICITATION_COOLDOWN_REASON,
    });
  }

  // ── 5b. Anti-doublon 5 min (tracking ou last_purchase)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const trackingForDup =
    category === 'ecommerce' ? resolveTrackingNumber(bodyUnknown) : '';

  const dupQ = admin
    .from('review_queue')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', phone)
    .gte('created_at', fiveMinutesAgo)
    .limit(1);

  if (trackingForDup) {
    dupQ.eq('metadata->>tracking_number', trackingForDup);
  } else if (lastPurchase) {
    dupQ.eq('metadata->>last_purchase', lastPurchase);
  } else {
    dupQ.is('metadata->>last_purchase', null);
  }

  const { data: duplicateZenith } = await dupQ.maybeSingle();
  if (duplicateZenith) {
    return NextResponse.json({ ok: true, queued: false, reason: 'duplicate_5min' });
  }

  // ── 6. Calcul scheduled_at avec jitter ±15% et sécurité sommeil ──────────
  //
  // Délai cible : business_category détermine le délai par défaut.
  // Si business_category = 'custom', utilise webhook_send_delay_minutes (config manuelle).
  // Formule jitter : finalDelay = targetMinutes * (0.85 + Math.random() * 0.30)
  // Si l'heure calculée > 21h Paris → report automatique au lendemain 10h30.
  const categoryDelay = category !== 'custom' ? (CATEGORY_DELAYS[category] ?? 45) : 0;
  const ecommerceStrategy = (profile as { ecommerce_delivery_strategy?: string | null })
    .ecommerce_delivery_strategy;
  const ecommerceCustomMinutes = (profile as { ecommerce_post_delivery_custom_minutes?: number | null })
    .ecommerce_post_delivery_custom_minutes;
  const ecommerceHybrid =
    category === 'ecommerce' && !ecommerceShipmentSignal;

  const targetMinutes = ecommerceHybrid
    ? ((profile.webhook_send_delay_minutes as number | null) ?? 45)
    : category === 'ecommerce'
      ? strategyToMinutes(ecommerceStrategy, ecommerceCustomMinutes)
      : categoryDelay > 0
        ? categoryDelay
        : ((profile.webhook_send_delay_minutes as number | null) ?? 45);
  const { scheduledAt, finalMinutes } = computeScheduledAt(targetMinutes);
  const callerIp = getCallerIp(request);

  const shipmentMeta =
    ecommerceShipmentSignal
      ? {
          shipment_status: resolveShipmentStatus(bodyUnknown),
          tracking_number: trackingForDup || null,
          ecommerce_post_delivery: true,
        }
      : ecommerceHybrid
        ? {
            ecommerce_post_delivery: false,
            ecommerce_hybrid_test: true,
          }
        : {};

  // ── 7. Insertion dans review_queue ───────────────────────────────────────
  const row: ReviewQueueInsert = {
    user_id:      userId,
    first_name:   firstName,
    phone:        phone,
    source_info:  sourceInfo,
    status:       'pending',
    scheduled_at: scheduledAt,
    metadata: {
      caller_ip:      callerIp,
      raw_phone:      phoneRaw,
      source_info:    sourceInfo,
      last_purchase:  lastPurchase,
      received_at:    new Date().toISOString(),
      target_minutes: targetMinutes,
      final_minutes:  finalMinutes,
      zenith_message_type: 'review',
      /** Traçabilité produit : même schéma que la route `api/webhooks/[api_key]`. */
      ingress:        'zenith_token',
      ...shipmentMeta,
    },
  };

  const { data: queuedRow, error: insertError } = await admin
    .from('review_queue')
    .insert(row)
    .select('id')
    .single();

  if (insertError) {
    console.error('[webhooks/zenith] review_queue insert:', insertError.message);
    return apiJsonError(request, 'errors.webhookQueueInsertFailed', 500);
  }

  if (queuedRow?.id) {
    safeIngestPosQueueEvent(admin, {
      userId,
      reviewQueueId: queuedRow.id as string,
      firstName,
      lastPurchase,
      sourceInfo,
      ingress: 'zenith_token',
    });
  }

  // ── 8. Réponse succès ─────────────────────────────────────────────────────
  return NextResponse.json(
    {
      ok: true,
      queued: true,
      scheduled_at: scheduledAt,
      delay_minutes: finalMinutes,       // délai réel après jitter (pour debug)
      ...(ecommerceHybrid && { mode: 'ecommerce_hybrid_test' as const }),
    },
    { status: 200 }
  );
}
