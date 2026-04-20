/**
 * POST /api/webhooks/:api_key
 *
 * Webhook d'ingestion client — version clé-dans-l'URL (format rtx_live_<uuid>).
 *
 * Authentification : la clé est passée directement dans le chemin d'URL.
 * Aucun header supplémentaire requis — compatible avec tous les POS et Zapier.
 *
 * Payload JSON — tous les alias sont acceptés, le premier non-vide est utilisé :
 *
 *   Prénom / Nom  : first_name · firstname · prenom · prénom · name · nom ·
 *                   customer_name · client_name · contact_name · full_name · fullname
 *
 *   Téléphone     : phone · tel · telephone · téléphone · mobile · phone_number ·
 *                   numero · numero_tel · numero_telephone · cell · cellphone
 *
 *   Dernier achat : last_purchase · purchase · produit · product · article ·
 *                   service · prestation · item · commande · order
 *
 *   Statut livraison (e-commerce, demande d'avis après colis) :
 *                   status · delivery_status · order_status · shipment_status
 *                   → Aucun de ces champs (ou valeur vide) : mode test / intégration — file d'attente
 *                     avec le délai général (webhook_send_delay_minutes), sans attendre un colis « Livré ».
 *                   → "Delivered" / "Livré" : programme l'envoi (2h / 24h / personnalisé selon le dashboard)
 *                   → "Shipped" / "Expédié" : attente, aucune file d'attente
 *
 *   Suivi colis   : tracking_number · tracking · numero_suivi · suivi
 *
 *   Consentement WhatsApp (RGPD, e-commerce obligatoire) :
 *                   whatsapp_consent · consent · marketing_consent
 *                   → true / oui : autorisé ; false / non : refusé (aucun envoi)
 *
 *   Source        : source_info · source · caisse · pos · terminal · device · channel
 *
 * Exemple minimal :
 *   { "nom": "Sophie", "tel": "+33612345678" }
 *
 * Sécurités :
 *   1. Validation de la clé API         → 401 si invalide / révoquée
 *   2. Vérification blacklist RGPD      → 200 silencieux
 *   3. Cooldown resollicitation 120 j  → 200 silencieux
 *   4. Anti-doublon 5 minutes          → 200 silencieux (même téléphone + même achat)
 *   5. Fenêtre de courtoisie 09h–21h   → report automatique au lendemain 10h30
 */

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebhookBody = Record<string, any>;

// ── Alias resolver ────────────────────────────────────────────────────────────

/**
 * Retourne la première valeur string non-vide trouvée parmi les clés candidates.
 * Insensible à la casse et aux espaces pour la comparaison des clés.
 */
function resolveField(body: WebhookBody, candidates: string[]): string {
  const normalizedBody: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === 'string' || typeof v === 'number') {
      normalizedBody[k.toLowerCase().trim()] = String(v).trim();
    }
  }
  for (const key of candidates) {
    const val = normalizedBody[key.toLowerCase()];
    if (val) return val;
  }
  return '';
}

const NAME_ALIASES = [
  'first_name', 'firstname', 'prenom', 'prénom',
  'name', 'nom',
  'customer_name', 'client_name', 'contact_name',
  'full_name', 'fullname',
];

const PHONE_ALIASES = [
  'phone', 'tel', 'telephone', 'téléphone',
  'mobile', 'phone_number',
  'numero', 'numéro', 'numero_tel', 'numéro_tel',
  'numero_telephone', 'numéro_téléphone',
  'cell', 'cellphone',
];

const PURCHASE_ALIASES = [
  'last_purchase', 'purchase',
  'produit', 'product',
  'article', 'service', 'prestation',
  'item', 'commande', 'order',
];

const SOURCE_ALIASES = [
  'source_info', 'source',
  'caisse', 'pos', 'terminal',
  'device', 'channel',
];

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/webhooks/:api_key
 * Health-check léger — utile pour vérifier que l'URL est bien accessible
 * avant de configurer Zapier ou un POS.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ api_key: string }> }
) {
  const { api_key } = await params;
  const t = createServerTranslator('Api', apiLocaleFromRequest(request));

  if (!api_key?.startsWith('rtx_live_')) {
    return apiJsonError(request, 'errors.invalidApiKey', 401);
  }

  return NextResponse.json(
    { ok: true, ready: true, message: t('webhookEndpointReady') },
    { status: 200 }
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ api_key: string }> }
) {
  const { api_key } = await params;
  const t = createServerTranslator('Api', apiLocaleFromRequest(request));

  // ── 1. Validation de la clé API ───────────────────────────────────────────
  if (!api_key?.startsWith('rtx_live_')) {
    return apiJsonError(request, 'errors.invalidApiKey', 401);
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error('[webhooks/api_key] Supabase admin non configuré');
    return apiJsonError(request, 'serviceUnavailable', 503);
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select(
      'id, subscription_plan, selected_plan, webhook_send_delay_minutes, business_category, ecommerce_delivery_strategy, ecommerce_post_delivery_custom_minutes, legal_compliance_accepted'
    )
    .eq('api_key', api_key)
    .maybeSingle();

  if (profileError) {
    console.error('[webhooks/api_key] profiles lookup:', profileError.message);
    return apiJsonError(request, 'errors.webhookApiKeyLookupFailed', 500);
  }

  if (!profile?.id) {
    return apiJsonError(request, 'errors.webhookApiKeyInvalidOrRevoked', 401);
  }

  if (!(profile as { legal_compliance_accepted?: boolean }).legal_compliance_accepted) {
    return apiJsonError(request, 'errors.webhookLegalCompliance', 403);
  }

  const userId = profile.id as string;

  // ── 2. Parsing et validation du body ─────────────────────────────────────
  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new Error('not an object');
    }
  } catch {
    return apiJsonError(request, 'errors.webhookJsonObjectExpected', 400);
  }

  const firstName   = resolveField(body, NAME_ALIASES);
  const phoneRaw    = resolveField(body, PHONE_ALIASES);
  const lastPurchase = resolveField(body, PURCHASE_ALIASES) || null;
  const sourceInfo   = resolveField(body, SOURCE_ALIASES) || null;

  if (!firstName) {
    return apiJsonError(request, 'errors.webhookNameFieldMissing', 400, {
      aliases: NAME_ALIASES.join(', '),
    });
  }
  if (!phoneRaw) {
    return apiJsonError(request, 'errors.webhookPhoneFieldMissing', 400, {
      aliases: PHONE_ALIASES.join(', '),
    });
  }

  const phone = normalizePhone(phoneRaw);

  const bodyUnknown = body as Record<string, unknown>;
  const category = ((profile as { business_category?: string | null }).business_category ?? 'custom') as string;

  // Présence d'un champ statut d'expédition → mode "suivi colis" (file après Livré).
  // Absence → mode "hybride" : file immédiate avec délai général (webhook_send_delay_minutes).
  const ecommerceShipmentSignal = category === 'ecommerce' && hasShipmentStatusField(bodyUnknown);
  const ecommerceHybrid = category === 'ecommerce' && !ecommerceShipmentSignal;

  // ── 3. Vérification blacklist RGPD ────────────────────────────────────────
  const { data: blacklisted } = await admin
    .from('blacklist')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', phone)
    .maybeSingle();

  if (blacklisted) {
    return NextResponse.json({ ok: true, queued: false, reason: 'blacklist' });
  }

  // ── 3b. E-commerce : consentement WhatsApp (RGPD) — toujours requis
  if (category === 'ecommerce') {
    const consent = parseWhatsappConsent(bodyUnknown);
    if (consent === 'no') {
      logWebhookConsentRejected('api_key', { user_id: userId, consent: 'false' });
      return NextResponse.json({ ok: true, queued: false, reason: 'consent_denied' });
    }
    if (consent === 'missing') {
      logWebhookConsentRejected('api_key', { user_id: userId, consent: 'missing' });
      return NextResponse.json({
        ok: true,
        queued: false,
        reason: 'consent_required',
        hint: t('webhookHint_whatsappConsent'),
      });
    }
  }

  // ── 3c. E-commerce + champs de statut d’expédition : file uniquement après Livré
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

  // ── 4. Cooldown resollicitation — review_queue ───────────────────────────
  const cooldownSince = solicitationCooldownCutoffIso();
  const { data: recentEntry } = await admin
    .from('review_queue')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', phone)
    .eq('status', 'sent')
    .gte('sent_at', cooldownSince)
    .limit(1)
    .maybeSingle();

  if (recentEntry) {
    return NextResponse.json({ ok: true, queued: false, reason: SOLICITATION_COOLDOWN_REASON });
  }

  // ── 5. Anti-doublon 5 minutes (même téléphone + même last_purchase) ───────
  // Bloque les appels webhook dupliqués (retry POS, double-clic Zapier, etc.)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const trackingForDup =
    category === 'ecommerce' ? resolveTrackingNumber(bodyUnknown) : '';

  const duplicateQuery = admin
    .from('review_queue')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', phone)
    .gte('created_at', fiveMinutesAgo)
    .limit(1);

  if (trackingForDup) {
    duplicateQuery.eq('metadata->>tracking_number', trackingForDup);
  } else if (lastPurchase) {
    duplicateQuery.eq('metadata->>last_purchase', lastPurchase);
  } else {
    duplicateQuery.is('metadata->>last_purchase', null);
  }

  const { data: duplicate } = await duplicateQuery.maybeSingle();

  if (duplicate) {
    return NextResponse.json({ ok: true, queued: false, reason: 'duplicate_5min' });
  }

  // ── 6. Calcul scheduled_at (délai adaptatif + fenêtre courtoisie) ─────────
  const categoryDelay = category !== 'custom' ? (CATEGORY_DELAYS[category] ?? 45) : 0;
  const ecommerceStrategy = (profile as { ecommerce_delivery_strategy?: string | null })
    .ecommerce_delivery_strategy;
  const ecommerceCustomMinutes = (profile as { ecommerce_post_delivery_custom_minutes?: number | null })
    .ecommerce_post_delivery_custom_minutes;
  // Mode hybride (e-commerce sans champ de statut livraison) : délai libre du marchand.
  // Mode livraison (e-commerce + champ statut présent) : stratégie post-delivery.
  const targetMinutes = ecommerceHybrid
    ? ((profile.webhook_send_delay_minutes as number | null) ?? 45)
    : category === 'ecommerce'
      ? strategyToMinutes(ecommerceStrategy, ecommerceCustomMinutes)
      : categoryDelay > 0
        ? categoryDelay
        : ((profile.webhook_send_delay_minutes as number | null) ?? 45);

  const { scheduledAt, finalMinutes } = computeScheduledAt(targetMinutes);
  const callerIp = getCallerIp(request);

  const shipmentMeta = ecommerceShipmentSignal
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

  // ── 7. Insertion dans review_queue ────────────────────────────────────────
  const { data: queuedRow, error: insertError } = await admin
    .from('review_queue')
    .insert({
      user_id: userId,
      first_name: firstName,
      phone: phone,
      source_info: sourceInfo,
      status: 'pending',
      scheduled_at: scheduledAt,
      metadata: {
        caller_ip: callerIp,
        raw_phone: phoneRaw,
        source_info: sourceInfo,
        last_purchase: lastPurchase,
        received_at: new Date().toISOString(),
        target_minutes: targetMinutes,
        final_minutes: finalMinutes,
        ingress: 'api_key',
        zenith_message_type: 'review',
        ...shipmentMeta,
      },
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[webhooks/api_key] review_queue insert:', insertError.message);
    return apiJsonError(request, 'errors.webhookQueueInsertFailed', 500);
  }

  if (queuedRow?.id) {
    safeIngestPosQueueEvent(admin, {
      userId,
      reviewQueueId: queuedRow.id as string,
      firstName,
      lastPurchase,
      sourceInfo,
      ingress: 'api_key',
    });
  }

  return NextResponse.json(
    {
      ok:            true,
      queued:        true,
      scheduled_at:  scheduledAt,
      delay_minutes: finalMinutes,
      ...(ecommerceHybrid && { mode: 'ecommerce_hybrid_test' as const }),
      resolved_fields: {
        first_name:    firstName,
        phone:         phone,
        last_purchase: lastPurchase,
        source_info:   sourceInfo,
      },
    },
    { status: 200 }
  );
}
