import { createAdminClient } from '@/lib/supabase/admin';
import { transcribeAudioFromUrl } from '@/lib/whisper';
import { generateModifiedResponse } from '@/lib/whatsapp-alerts/generate-modified-response';
import { sendWhatsAppInteractiveCard } from '@/lib/whatsapp-alerts/send-whatsapp-alert';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import { handleCaptureReply } from '@/lib/zenith-capture/handle-capture-reply';

export const runtime = 'nodejs';
export const maxDuration = 60;

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) digits = '33' + digits.slice(1);
  return digits;
}

function isApproval(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'ok' || t === 'oui' || t === 'valider';
}

const twimlResponse = () =>
  new Response('<Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });

/**
 * Webhook pour les réponses texte/vocal WhatsApp.
 * Gère : (1) Flux Zenith Capture, (2) Flux alerte avis négatif.
 * Twilio envoie application/x-www-form-urlencoded.
 */
export async function POST(request: Request) {
  console.log('--- VERSION SYNCHRONE ACTIVE ---');

  let body = '';
  let buttonText = '';
  let fromRaw = '';
  let numMedia = 0;
  let mediaUrl: string | undefined;
  let mediaType = '';

  try {
    const form = await request.formData();
    body = form.get('Body')?.toString()?.trim() ?? '';
    buttonText = form.get('ButtonText')?.toString()?.trim() ?? '';
    fromRaw = form.get('From')?.toString() ?? '';
    numMedia = parseInt(form.get('NumMedia')?.toString() ?? '0', 10);
    mediaUrl = form.get('MediaUrl0')?.toString();
    mediaType = form.get('MediaContentType0')?.toString() ?? '';

    console.log('[whatsapp-reply] Données Twilio reçues:', {
      Body: body,
      ButtonText: buttonText,
      MediaUrl0: mediaUrl,
      From: fromRaw,
      NumMedia: numMedia,
      MediaContentType0: mediaType,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '(défini)' : '(MANQUANT)',
    });
  } catch (e) {
    console.error('[whatsapp-reply] Erreur parsing form:', e);
    return twimlResponse();
  }

  const fromPhone = fromRaw.replace(/^whatsapp:/, '');
  const normalized = normalizePhone(fromPhone);

  if (!fromPhone) {
    console.error('[whatsapp-reply] From manquant');
    return twimlResponse();
  }

  // Détection clics sur boutons (ButtonText ou Body)
  const clickText = buttonText ?? body;
  if (clickText.includes('Valider') && clickText.includes('Envoyer')) {
    console.log('[Flux] Bouton Valider reçu');
    console.log('PUBLICATION SUR GOOGLE...');
    await sendWhatsAppMessage(fromPhone, "🚀 C'est publié avec succès !");
    return twimlResponse();
  }
  if (clickText.includes('Modifier') && (clickText.includes('Vocal') || clickText.includes('🎙️'))) {
    console.log('[Flux] Bouton Modifier (Vocal) reçu');
    await sendWhatsAppMessage(fromPhone, 'Je vous écoute, que voulez-vous changer ?');
    return twimlResponse();
  }
  if (clickText.includes('Refuser') || clickText.includes('❌')) {
    console.log('[Flux] Bouton Refuser reçu - ACTION: REFUS');
    return twimlResponse();
  }

  let instruction: string;

  // 2. Flux alerte avis négatif
  if (numMedia > 0 && mediaUrl) {
    console.log('[Transcription] Détection vocal: NumMedia=' + numMedia + ', MediaUrl0=' + mediaUrl);
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      console.error('[Transcription] Twilio auth manquant');
      await sendWhatsAppMessage(
        fromPhone,
        "Configuration Twilio manquante pour le vocal. Contactez le support."
      );
      return twimlResponse();
    }
    try {
      console.log('[Transcription] Téléchargement audio...');
      instruction = await transcribeAudioFromUrl(mediaUrl, {
        twilioAuth: { accountSid, authToken },
        language: 'fr',
      });
      console.log('[Transcription] Résultat:', instruction);
    } catch (whisperErr) {
      console.error('[Transcription] Erreur Whisper:', whisperErr);
      await sendWhatsAppMessage(
        fromPhone,
        "Désolé Chef, je n'ai pas pu transcrire le vocal. Réessayez ou envoyez un message texte."
      );
      return twimlResponse();
    }
  } else {
    instruction = body;
  }

  if (!instruction?.trim() && numMedia === 0) {
    await sendWhatsAppMessage(
      fromPhone,
      "Je n'ai pas pu comprendre votre message. Envoyez du texte ou un vocal pour modifier la réponse, ou tapez OK pour valider."
    );
    return twimlResponse();
  }

  const supabase = createAdminClient();

  // 1. Flux Zenith Capture (prioritaire si session active)
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioAuth = accountSid && authToken ? { accountSid, authToken } : undefined;
  const handled = await handleCaptureReply({
    fromPhone,
    normalizedPhone: normalized,
    text: instruction?.trim() || body || '',
    mediaUrl: numMedia > 0 && !instruction?.trim() ? mediaUrl : undefined,
    twilioAuth,
  });
  if (handled) return twimlResponse();
  const { data: mapping } = supabase
    ? await supabase
        .from('whatsapp_outbound_mapping')
        .select('review_id')
        .eq('to_phone', normalized)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const reviewId = mapping?.review_id;
  let review: {
    id: string;
    user_id: string;
    reviewer_name: string;
    comment: string;
    ai_response: string | null;
  } | null = null;

  if (reviewId && supabase) {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, user_id, reviewer_name, comment, ai_response')
      .eq('id', reviewId)
      .single();
    if (!error && data) review = data;
  }

  if (!review) {
    const v2 = await generateModifiedResponse({
      originalReview: '(avis non retrouvé)',
      firstResponse: '(aucune)',
      patronInstruction: instruction,
    });
    const fallbackMsg = `Désolé Chef, je n'ai pas retrouvé l'avis original, mais voici une suggestion basée sur votre message :\n\n${v2}`;
    await sendWhatsAppMessage(fromPhone, fallbackMsg);
    console.log('[whatsapp-reply] Fallback sans DB - suggestion envoyée');
    return twimlResponse();
  }

  if (isApproval(instruction)) {
    const textToPublish = (review.ai_response ?? '').trim();
    if (!textToPublish) {
      await sendWhatsAppMessage(
        fromPhone,
        "Aucune réponse à valider. Envoyez une instruction pour générer une modification."
      );
      return twimlResponse();
    }
    if (supabase && reviewId) {
      await supabase
        .from('reviews')
        .update({ response_text: textToPublish, status: 'scheduled' })
        .eq('id', reviewId)
        .eq('user_id', review.user_id);
    }
    await sendWhatsAppMessage(fromPhone, "✅ Réponse validée ! Elle sera publiée prochainement.");
    return twimlResponse();
  }

  const firstResponse = (review.ai_response ?? '').trim() || 'Réponse non disponible.';
  const v2 = await generateModifiedResponse({
    originalReview: review.comment,
    firstResponse,
    patronInstruction: instruction,
  });

  if (supabase && reviewId) {
    await supabase
      .from('reviews')
      .update({ ai_response: v2 })
      .eq('id', reviewId)
      .eq('user_id', review.user_id);
  }

  console.log('[Flux] Renvoi de la carte après modification', {
    reviewerName: review.reviewer_name,
    commentLen: review.comment?.length ?? 0,
    v2Len: v2?.length ?? 0,
  });
  const sendResult = await sendWhatsAppInteractiveCard({
    to: fromPhone,
    reviewerName: review.reviewer_name ?? 'Client',
    comment: review.comment ?? '(Aucun commentaire)',
    suggestedReply: v2,
  });

  if (!sendResult.success) {
    console.error('[whatsapp-reply] Envoi carte interactive erreur:', sendResult.error);
  }

  return twimlResponse();
}
