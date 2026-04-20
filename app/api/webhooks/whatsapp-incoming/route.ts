/**
 * POST /api/webhooks/whatsapp-incoming
 *
 * Webhook de réception des messages WhatsApp clients — Flux NLU complet.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  STATE MACHINE DE CONVERSATION                                      │
 * │                                                                     │
 * │  NULL/sent ──"1"──► awaiting_review                                 │
 * │           ──"2"/STOP ──► cancelled  (blacklist + au revoir poli)   │
 * │                                                                     │
 * │  awaiting_review ──[texte/vocal OK]──► review_generated             │
 * │                  ──[insatisfaction]──► cancelled (empathie, no GMB) │
 * │                                                                     │
 * │  review_generated ──"publish_review_id:XYZ"──► published            │
 * │                  ──"modify_review" / [texte]──► awaiting_review     │
 * │                                                                     │
 * │  published / cancelled ──► ignorer silencieusement                  │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Compatible Twilio (form-urlencoded) et Meta Cloud API (JSON).
 * Supporte les messages vocaux (transcription Whisper).
 * Délai humain simulé avant chaque réponse (calculateHumanDelay).
 */

import { NextResponse } from 'next/server';
import { apiJsonError } from '@/lib/api/api-error-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import { sendWhatsAppInteractive } from '@/lib/whatsapp-alerts/send-whatsapp-interactive';
import { polishReview, detectSentiment, generateCourtesyExit } from '@/lib/whatsapp-alerts/polish-review';
import {
  generatePostConsentFeedbackMessage,
  staticPostConsentFallback,
} from '@/lib/whatsapp-alerts/post-consent-feedback-message';
import { addToBlacklist, normalizePhone } from '@/lib/zenith-capture/can-contact';
import { calculateHumanDelay } from '@/lib/whatsapp-alerts/human-delay';
import { transcribeAudioFromUrl } from '@/lib/whisper';
import { insertConsentLog } from '@/lib/consent-log';
import {
  appendChallengeToWhatsAppBody,
  getChallengeWhatsAppAppendixForMerchant,
  isChallengeMessagingActive,
  type ChallengeForWhatsApp,
} from '@/lib/reputexa-challenge/whatsapp-appendix';
import { canAccessReputexaChallenge } from '@/lib/reputexa-challenge/subscription-access';
import { safeIngestInteractionMemory } from '@/lib/omni-synapse';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConversationState = 'awaiting_review' | 'review_generated' | 'published' | 'cancelled' | null;

type Intent =
  | 'reply_1'          // Client veut laisser un avis
  | 'unsubscribe'      // "2", "STOP", "arrêt"
  | 'modify_review'    // Bouton "Modifier" ou texte 'M'
  | 'publish_review'   // Bouton "Publier" ou texte 'P'
  | 'free_text';       // Texte brut (avis brut ou inconnu)

type IncomingMessage = {
  from: string;
  body: string;
  /** URL du media audio si le client a envoyé un vocal */
  mediaUrl?: string;
  /** Content-Type du media (ex: 'audio/ogg') */
  mediaContentType?: string;
  /** ID du message Meta Cloud API (pour statut "read") */
  incomingMsgId?: string;
};

type QueueEntry = {
  id: string;
  user_id: string;
  first_name: string | null;
  phone: string;
  conversation_state: ConversationState;
  metadata: Record<string, unknown> | null;
};

type MerchantProfile = {
  id: string;
  establishment_name: string | null;
  full_name: string | null;
  google_review_url: string | null;
  establishment_type: string | null;
  address: string | null;
  subscription_plan: string | null;
};

// ── Résolution URL audio Meta Cloud API ──────────────────────────────────────

/**
 * Récupère l'URL de téléchargement d'un media Meta Cloud API via son ID.
 * Nécessite WHATSAPP_META_ACCESS_TOKEN.
 */
async function resolveMetaMediaUrl(mediaId: string): Promise<string | null> {
  const token = process.env.WHATSAPP_META_ACCESS_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json() as { url?: string };
    return json.url ?? null;
  } catch {
    return null;
  }
}

// ── Multi-format parser ───────────────────────────────────────────────────────

async function parseIncoming(request: Request): Promise<IncomingMessage | null> {
  const contentType = request.headers.get('content-type') ?? '';

  // ── Twilio (form-urlencoded) ───────────────────────────────────────────────
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const from = params.get('From')?.replace(/^whatsapp:/i, '').trim();
    const body = params.get('Body')?.trim() ?? '';
    if (!from) return null;

    // Gestion des messages vocaux Twilio
    const numMedia = parseInt(params.get('NumMedia') ?? '0', 10);
    const mediaUrl = params.get('MediaUrl0') ?? undefined;
    const mediaContentType = params.get('MediaContentType0') ?? undefined;

    return {
      from: normalizePhone(from),
      body,
      mediaUrl: numMedia > 0 ? mediaUrl : undefined,
      mediaContentType: numMedia > 0 ? mediaContentType : undefined,
    };
  }

  // ── Meta Cloud API (JSON) ─────────────────────────────────────────────────
  const json = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!json) return null;

  type MetaEntry = { changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }> };
  const entry = (json?.entry as MetaEntry[] | undefined)?.[0];
  const value = entry?.changes?.[0]?.value;
  const msg = value?.messages?.[0];
  if (!msg) return null;

  const from = (msg.from as string | undefined)?.trim();
  if (!from) return null;

  const incomingMsgId = (msg.id as string | undefined) ?? undefined;
  let body = '';
  let mediaUrl: string | undefined;
  let mediaContentType: string | undefined;

  if (msg.type === 'text') {
    body = ((msg.text as Record<string, string> | undefined)?.body ?? '').trim();

  } else if (msg.type === 'interactive') {
    type ButtonReply = { type?: string; button_reply?: { id?: string; title?: string } };
    const interactive = msg.interactive as ButtonReply | undefined;
    if (interactive?.type === 'button_reply') {
      body = interactive.button_reply?.id ?? interactive.button_reply?.title ?? '';
    }

  } else if (msg.type === 'button') {
    type ButtonMsg = { payload?: string; text?: string };
    const btn = msg.button as ButtonMsg | undefined;
    body = (btn?.payload ?? btn?.text ?? '').trim();

  } else if (msg.type === 'audio') {
    // Message vocal Meta — résolution de l'URL via l'ID du media
    type AudioMsg = { id?: string; mime_type?: string };
    const audio = msg.audio as AudioMsg | undefined;
    if (audio?.id) {
      const resolved = await resolveMetaMediaUrl(audio.id);
      if (resolved) {
        mediaUrl = resolved;
        mediaContentType = audio.mime_type ?? 'audio/ogg';
      }
    }
  }

  return { from: normalizePhone(from), body, mediaUrl, mediaContentType, incomingMsgId };
}

// ── Transcription vocale (Whisper) ────────────────────────────────────────────

/**
 * Transcrit un message audio WhatsApp via Whisper.
 * Compatible Twilio (auth Basic) et Meta Cloud API (auth Bearer).
 */
async function transcribeIfAudio(incoming: IncomingMessage): Promise<string | null> {
  if (!incoming.mediaUrl) return null;
  if (!incoming.mediaContentType?.startsWith('audio/')) return null;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const metaToken  = process.env.WHATSAPP_META_ACCESS_TOKEN;

  // Détermine si c'est une URL Twilio ou Meta
  const isTwilioUrl = incoming.mediaUrl.includes('twilio.com') || incoming.mediaUrl.includes('api.twilio.com');

  try {
    if (isTwilioUrl && accountSid && authToken) {
      return await transcribeAudioFromUrl(incoming.mediaUrl, {
        twilioAuth: { accountSid, authToken },
        language: 'fr',
      });
    }

    if (!isTwilioUrl && metaToken) {
      // Meta Cloud API : l'URL de téléchargement nécessite le Bearer token
      return await transcribeAudioFromUrl(incoming.mediaUrl, {
        language: 'fr',
      });
    }

    console.warn('[whatsapp-incoming] Credentials manquants pour la transcription audio');
    return null;
  } catch (err) {
    console.error('[whatsapp-incoming] Erreur Whisper:', err);
    return null;
  }
}

// ── Intent detector ───────────────────────────────────────────────────────────

function detectIntent(body: string, conversationState: ConversationState): Intent {
  const norm = body.trim().toLowerCase();

  // ── STOP / désinscription — toujours prioritaire ──────────────────────────
  // Inclut "2", "non", "non merci", "stop", "arrêt"
  if (
    norm === '2' ||
    norm === 'stop' ||
    norm === 'arrêt' ||
    norm === 'arret' ||
    // "Non" à la question de permission (Étape A) — blacklist si pas encore en conversation
    ((norm === 'non' || norm === 'non merci' || norm === 'no') && !conversationState)
  ) {
    return 'unsubscribe';
  }

  // ── Accord / permission (Étape A) — "1" ou "oui" avant toute conversation ─
  if (!conversationState && (norm === '1' || norm === 'oui' || norm === 'ok' || norm === 'yes')) {
    return 'reply_1';
  }

  // ── Bouton ou texte "Publier" ──────────────────────────────────────────────
  if (body.startsWith('publish_review_id:') || norm === 'p' || norm === 'publier') {
    return 'publish_review';
  }

  // ── Bouton ou texte "Modifier" ────────────────────────────────────────────
  if (norm === 'modify_review' || norm === 'm' || norm === 'modifier') {
    return 'modify_review';
  }

  // ── Tout autre texte = texte libre (Étape C : récit d'expérience) ─────────
  return 'free_text';
}

/** Refus permission (non) vs STOP explicite — pour consent_logs. */
function classifyUnsubscribeConsent(body: string): 'no' | 'stop' {
  const norm = body.trim().toLowerCase();
  if (
    norm === '2' ||
    norm === 'stop' ||
    norm === 'arrêt' ||
    norm === 'arret'
  ) {
    return 'stop';
  }
  return 'no';
}

// ── Helpers de résolution ─────────────────────────────────────────────────────

async function resolveActiveConversation(phone: string): Promise<{
  entry: QueueEntry;
  merchant: MerchantProfile;
} | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: entry } = await admin
    .from('review_queue')
    .select('id, user_id, first_name, phone, conversation_state, metadata')
    .eq('phone', phone)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!entry?.user_id) return null;

  const { data: merchant } = await admin
    .from('profiles')
    .select('id, establishment_name, full_name, google_review_url, establishment_type, address, subscription_plan')
    .eq('id', entry.user_id as string)
    .maybeSingle();

  if (!merchant) return null;

  return {
    entry: entry as unknown as QueueEntry,
    merchant: merchant as unknown as MerchantProfile,
  };
}

function buildEstablishmentName(merchant: MerchantProfile): string {
  return (
    merchant.establishment_name?.trim() ||
    merchant.full_name?.trim() ||
    'votre commerce'
  );
}

async function loadMerchantChallengeCampaign(userId: string): Promise<ChallengeForWhatsApp | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from('reputexa_challenge_campaigns')
    .select('is_active, starts_at, ends_at, competition_message')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  return data as ChallengeForWhatsApp;
}

// ── Mise à jour état conversation ─────────────────────────────────────────────

async function updateConversationState(
  entryId: string,
  state: ConversationState,
  metadataPatch: Record<string, unknown> = {}
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const patch: Record<string, unknown> = { conversation_state: state };

  if (Object.keys(metadataPatch).length > 0) {
    const { data: current } = await admin
      .from('review_queue')
      .select('metadata')
      .eq('id', entryId)
      .maybeSingle();

    const existingMeta = (current?.metadata as Record<string, unknown> | null) ?? {};
    patch.metadata = { ...existingMeta, ...metadataPatch };
    await admin.from('review_queue').update(patch).eq('id', entryId);
    return;
  }

  await admin.from('review_queue').update(patch).eq('id', entryId);
}

// ── Handlers par intent ───────────────────────────────────────────────────────

async function handleReply1(
  phone: string,
  entry: QueueEntry,
  merchant: MerchantProfile,
  incomingMsgId?: string,
  rawBody?: string,
): Promise<void> {
  await insertConsentLog({
    merchantId: merchant.id,
    reviewQueueId: entry.id,
    phone,
    consentType: 'yes',
    messagePreview: rawBody,
    metadata: { step: 'permission_accept' },
  });

  const name = buildEstablishmentName(merchant);
  const lastPurchase = typeof entry.metadata?.last_purchase === 'string'
    ? entry.metadata.last_purchase.trim()
    : null;

  const ch = await loadMerchantChallengeCampaign(merchant.id);
  const appendix = getChallengeWhatsAppAppendixForMerchant(ch, merchant.subscription_plan);

  const inviteParams = {
    establishmentName: name,
    establishmentType: merchant.establishment_type,
    firstName: entry.first_name,
    lastPurchase,
  };
  const generated = await generatePostConsentFeedbackMessage(inviteParams);
  let message = generated ?? staticPostConsentFallback(inviteParams);
  message = appendChallengeToWhatsAppBody(message, appendix);

  await calculateHumanDelay(message, phone, incomingMsgId);
  await sendWhatsAppMessage(phone, message);

  await updateConversationState(entry.id, 'awaiting_review', {
    review_started_at: new Date().toISOString(),
  });
}

async function handleFreeText(
  phone: string,
  entry: QueueEntry,
  merchant: MerchantProfile,
  rawText: string,
  incomingMsgId?: string,
): Promise<void> {
  const name = buildEstablishmentName(merchant);

  // ── 1. Détection de sentiment AVANT de polir ──────────────────────────────
  const sentiment = await detectSentiment(rawText);

  // ── 2a. Client insatisfait → sortie empathique sans lien Google ───────────
  if (sentiment === 'dissatisfied') {
    console.info(`[whatsapp-incoming] Insatisfaction détectée pour entry=${entry.id} — sortie courtoise activée.`);

    const { message } = await generateCourtesyExit({
      type: 'dissatisfaction',
      establishmentName: name,
      firstName: entry.first_name,
    });

    await calculateHumanDelay(message, phone, incomingMsgId);
    await sendWhatsAppMessage(phone, message);

    await updateConversationState(entry.id, 'cancelled', {
      cancelled_at: new Date().toISOString(),
      cancel_reason: 'client_dissatisfied',
      raw_feedback: rawText,
    });

    const adminDiss = createAdminClient();
    if (adminDiss) {
      safeIngestInteractionMemory(adminDiss, {
        userId: merchant.id,
        channel: 'whatsapp',
        canonicalText: `Client insatisfait (${entry.first_name}) — ${name}. Retour: ${rawText.slice(0, 2000)}`,
        metadata: { review_queue_id: entry.id, sentiment: 'dissatisfied' },
      });
    }

    return;
  }

  // ── 2b. Client satisfait ou neutre → flux de sublimation ──────────────────
  const processingMsg = `Merci pour votre retour ✨ On vous prépare une version claire de quelques lignes, une petite seconde…`;
  await calculateHumanDelay(processingMsg, phone, incomingMsgId);
  await sendWhatsAppMessage(phone, processingMsg);

  // Extraction de la ville depuis l'adresse du profil commerçant (SEO local)
  const city = merchant.address?.trim() || null;

  const ch = await loadMerchantChallengeCampaign(merchant.id);
  const internalChallengeActive =
    canAccessReputexaChallenge(merchant.subscription_plan) && isChallengeMessagingActive(ch);

  const { polishedReview } = await polishReview({
    rawReview: rawText,
    establishmentName: name,
    establishmentType: merchant.establishment_type,
    city,
    internalChallengeActive,
  });

  await updateConversationState(entry.id, 'review_generated', {
    raw_review: rawText,
    polished_review: polishedReview,
    review_generated_at: new Date().toISOString(),
  });

  const adminOmni = createAdminClient();
  if (adminOmni) {
    safeIngestInteractionMemory(adminOmni, {
      userId: merchant.id,
      channel: 'whatsapp',
      canonicalText:
        `Retour client (${entry.first_name}) pour ${name}. Brut: ${rawText.slice(0, 1200)} | ` +
        `Version polie: ${polishedReview.slice(0, 1200)}`,
      metadata: { review_queue_id: entry.id, step: 'review_generated' },
    });
  }

  const previewText =
    `✍️ *Votre avis prêt à publier :*\n\n` +
    `_"${polishedReview}"_\n\n` +
    `Cela vous convient ? Vous pouvez le publier en un clic ou demander une retouche.`;

  await calculateHumanDelay(previewText, phone);
  await sendWhatsAppInteractive(phone, previewText, [
    { id: 'modify_review', title: '🖊️ Modifier' },
    { id: `publish_review_id:${entry.id}`, title: '✅ Publier' },
  ]);
}

async function handleModifyReview(
  phone: string,
  entry: QueueEntry,
  incomingMsgId?: string,
): Promise<void> {
  await updateConversationState(entry.id, 'awaiting_review', {
    modify_requested_at: new Date().toISOString(),
  });

  const message = `Bien sûr 😊 Racontez à nouveau comme vous le sentez — texte ou vocal — et on ajuste le texte jusqu’à ce que ça vous colle.`;
  await calculateHumanDelay(message, phone, incomingMsgId);
  await sendWhatsAppMessage(phone, message);
}

async function handlePublishReview(
  phone: string,
  entry: QueueEntry,
  merchant: MerchantProfile,
  reviewId: string,
  incomingMsgId?: string,
): Promise<void> {
  await updateConversationState(entry.id, 'published', {
    published_at: new Date().toISOString(),
    publish_link_sent_at: new Date().toISOString(),
  });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://reputexa.fr';
  const publishUrl = `${baseUrl}/api/review/publish?id=${reviewId}`;

  const intro =
    `Parfait ! 🎉\n\nOuvrez le *message suivant* : c'est un lien. Au clic, votre avis est *copié automatiquement* dans le presse-papiers, puis vous êtes envoyé sur Google pour coller, choisir votre note et publier.`;
  await calculateHumanDelay(intro, phone, incomingMsgId);
  await sendWhatsAppMessage(phone, intro);
  await sendWhatsAppMessage(phone, publishUrl);
  const thanks = `Merci infiniment au nom de toute l'équipe de ${buildEstablishmentName(merchant)} ! 🙏`;
  await calculateHumanDelay(thanks, phone, incomingMsgId);
  await sendWhatsAppMessage(phone, thanks);
}

async function handleUnsubscribe(
  phone: string,
  userId: string | null,
  entry: QueueEntry | null,
  merchant: MerchantProfile | null,
  incomingMsgId?: string,
  rawBody?: string,
): Promise<void> {
  if (userId && entry && merchant && rawBody !== undefined) {
    await insertConsentLog({
      merchantId: userId,
      reviewQueueId: entry.id,
      phone,
      consentType: classifyUnsubscribeConsent(rawBody),
      messagePreview: rawBody,
      metadata: { step: 'unsubscribe_or_refusal' },
    });
  }

  if (userId) {
    await addToBlacklist(userId, phone);
  }

  if (entry) {
    await updateConversationState(entry.id, 'cancelled', {
      cancelled_at: new Date().toISOString(),
      cancel_reason: 'client_stop',
    });
  }

  const establishmentName = merchant ? buildEstablishmentName(merchant) : 'notre établissement';
  const { message } = await generateCourtesyExit({
    type: 'refusal',
    establishmentName,
    firstName: entry?.first_name,
  });

  await calculateHumanDelay(message, phone, incomingMsgId);
  await sendWhatsAppMessage(phone, message);
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const incoming = await parseIncoming(request);
    if (!incoming) {
      return NextResponse.json({ ok: true, action: 'ignored', reason: 'unparseable' });
    }

    const { from: phone, incomingMsgId } = incoming;
    if (!phone) {
      return NextResponse.json({ ok: true, action: 'ignored', reason: 'no_phone' });
    }

    // ── Résolution de la conversation active ──────────────────────────────────
    const context = await resolveActiveConversation(phone);
    const currentState: ConversationState = (context?.entry.conversation_state) ?? null;

    // ── Transcription vocale si nécessaire ────────────────────────────────────
    let body = incoming.body;
    if (!body && incoming.mediaUrl) {
      const transcribed = await transcribeIfAudio(incoming);
      if (transcribed?.trim()) {
        body = transcribed.trim();
        console.info(`[whatsapp-incoming] Vocal transcrit (${body.length} chars) phone=${phone}`);
      } else {
        // Impossible de transcrire — informer poliment
        if (context) {
          const sorryMsg = `Désolé, je n'ai pas réussi à transcrire votre message vocal. Pourriez-vous nous l'envoyer en texte ? Merci 🙏`;
          await calculateHumanDelay(sorryMsg, phone, incomingMsgId);
          await sendWhatsAppMessage(phone, sorryMsg);
        }
        return NextResponse.json({ ok: true, action: 'audio_transcription_failed' });
      }
    }

    const intent = detectIntent(body, currentState);

    console.info(
      `[whatsapp-incoming] phone=${phone} state=${currentState ?? 'null'} intent=${intent} body="${body.slice(0, 80)}"`
    );

    // ── STOP / désinscription — toujours prioritaire ──────────────────────────
    if (intent === 'unsubscribe') {
      await handleUnsubscribe(
        phone,
        context?.entry.user_id ?? null,
        context?.entry ?? null,
        context?.merchant ?? null,
        incomingMsgId,
        body,
      );
      return NextResponse.json({ ok: true, action: 'unsubscribed' });
    }

    // ── Pas de contexte — ne peut pas continuer ───────────────────────────────
    if (!context) {
      console.warn(`[whatsapp-incoming] Aucune conversation active pour phone=${phone}`);
      return NextResponse.json({ ok: true, action: 'ignored', reason: 'no_context' });
    }

    const { entry, merchant } = context;

    // ── "1" : démarrer la collecte d'avis ────────────────────────────────────
    if (intent === 'reply_1') {
      await handleReply1(phone, entry, merchant, incomingMsgId, body);
      return NextResponse.json({ ok: true, action: 'awaiting_review_sent' });
    }

    // ── Modifier l'avis ───────────────────────────────────────────────────────
    if (intent === 'modify_review') {
      await handleModifyReview(phone, entry, incomingMsgId);
      return NextResponse.json({ ok: true, action: 'modify_requested' });
    }

    // ── Publier l'avis ────────────────────────────────────────────────────────
    if (intent === 'publish_review') {
      let reviewId = entry.id;
      if (body.startsWith('publish_review_id:')) {
        reviewId = body.split(':')[1]?.trim() || entry.id;
      }
      await handlePublishReview(phone, entry, merchant, reviewId, incomingMsgId);
      return NextResponse.json({ ok: true, action: 'published', review_id: reviewId });
    }

    // ── Conversation déjà annulée — ignorer silencieusement ──────────────────
    if (currentState === 'cancelled') {
      return NextResponse.json({ ok: true, action: 'ignored', reason: 'conversation_cancelled' });
    }

    // ── Texte libre — détecter sentiment puis polir ou sortir courtoisement ──
    if (intent === 'free_text') {
      const acceptableStates: ConversationState[] = ['awaiting_review', 'review_generated', null];
      if (acceptableStates.includes(currentState)) {
        await handleFreeText(phone, entry, merchant, body, incomingMsgId);
        return NextResponse.json({ ok: true, action: 'review_processed' });
      }
    }

    return NextResponse.json({ ok: true, action: 'ignored', reason: 'no_handler' });

  } catch (error) {
    console.error('[whatsapp-incoming]', error);
    // Toujours 200 pour éviter les retries Twilio/Meta
    return NextResponse.json({ ok: true, error: 'internal' });
  }
}

// ── Vérification webhook Meta Cloud API ──────────────────────────────────────

export async function GET(request: Request) {
  const url       = new URL(request.url);
  const mode      = url.searchParams.get('hub.mode');
  const token     = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? process.env.CRON_SECRET;

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return apiJsonError(request, 'forbidden', 403);
}
