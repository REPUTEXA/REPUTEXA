import { createAdminClient } from '@/lib/supabase/admin';
import { transcribeAudioFromUrl } from '@/lib/whisper';
import { generateModifiedResponse } from '@/lib/whatsapp-alerts/generate-modified-response';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';

export const runtime = 'nodejs';

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
 * Webhook pour les réponses texte/vocal de l'utilisateur après une alerte avis négatif.
 * Twilio envoie application/x-www-form-urlencoded.
 * Traitement 100% synchrone : on attend Whisper + IA avant de répondre.
 */
export async function POST(request: Request) {
  console.log('--- VERSION SYNCHRONE ACTIVE ---');

  let body = '';
  let fromRaw = '';
  let numMedia = 0;
  let mediaUrl: string | undefined;
  let mediaType = '';

  try {
    const form = await request.formData();
    body = form.get('Body')?.toString()?.trim() ?? '';
    fromRaw = form.get('From')?.toString() ?? '';
    numMedia = parseInt(form.get('NumMedia')?.toString() ?? '0', 10);
    mediaUrl = form.get('MediaUrl0')?.toString();
    mediaType = form.get('MediaContentType0')?.toString() ?? '';

    console.log('[whatsapp-reply] Données Twilio reçues:', {
      Body: body,
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

  let instruction: string;

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

  if (!instruction?.trim()) {
    await sendWhatsAppMessage(
      fromPhone,
      "Je n'ai pas pu comprendre votre message. Envoyez du texte ou un vocal pour modifier la réponse, ou tapez OK pour valider."
    );
    return twimlResponse();
  }

  const supabase = createAdminClient();
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
  let review: { id: string; user_id: string; comment: string; ai_response: string | null } | null = null;

  if (reviewId && supabase) {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, user_id, comment, ai_response')
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

  const replyBody = `Entendu Chef ! Voici la version modifiée :\n\n${v2}`;
  const sendResult = await sendWhatsAppMessage(fromPhone, replyBody);

  if (!sendResult.success) {
    console.error('[whatsapp-reply] Envoi erreur:', sendResult.error);
  }

  return twimlResponse();
}
