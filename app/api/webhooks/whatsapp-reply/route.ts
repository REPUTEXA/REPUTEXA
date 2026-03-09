import { createAdminClient } from '@/lib/supabase/admin';
import { transcribeAudioFromUrl } from '@/lib/whisper';
import { generateModifiedResponse } from '@/lib/whatsapp-alerts/generate-modified-response';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) digits = '33' + digits.slice(1);
  return digits;
}

function isApproval(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'ok' || t === 'oui' || t === 'valider';
}

/**
 * Webhook pour les réponses texte/vocal de l'utilisateur après une alerte avis négatif.
 * Twilio envoie application/x-www-form-urlencoded.
 * On renvoie 200 TwiML immédiatement, puis on traite en arrière-plan.
 */
export async function POST(request: Request) {
  const twimlResponse = () =>
    new Response('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });

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

    // Logs de Guerre : toutes les données Twilio
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

  // Réponse immédiate 200 TwiML pour éviter timeout Twilio
  void (async () => {
    try {
      if (!fromPhone) {
        console.error('[whatsapp-reply] From manquant');
        return;
      }

      let instruction: string;

      if (numMedia >= 1 && mediaUrl && mediaType?.toLowerCase().startsWith('audio/')) {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        if (!accountSid || !authToken) {
          await sendWhatsAppMessage(
            fromPhone,
            "Configuration Twilio manquante pour le vocal. Contactez le support."
          );
          return;
        }
        try {
          instruction = await transcribeAudioFromUrl(mediaUrl, {
            twilioAuth: { accountSid, authToken },
            language: 'fr',
          });
          console.log('[whatsapp-reply] Transcription Whisper:', instruction);
        } catch (whisperErr) {
          console.error('[whatsapp-reply] Whisper erreur:', whisperErr);
          await sendWhatsAppMessage(
            fromPhone,
            "Désolé Chef, je n'ai pas pu transcrire le vocal. Réessayez ou envoyez un message texte."
          );
          return;
        }
      } else {
        instruction = body;
      }

      if (!instruction?.trim()) {
        await sendWhatsAppMessage(
          fromPhone,
          "Je n'ai pas pu comprendre votre message. Envoyez du texte ou un vocal pour modifier la réponse, ou tapez OK pour valider."
        );
        return;
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

      // Fallback sans base : pas de mapping ou review introuvable
      if (!review) {
        const v2 = await generateModifiedResponse({
          originalReview: '(avis non retrouvé)',
          firstResponse: '(aucune)',
          patronInstruction: instruction,
        });
        const fallbackMsg = `Désolé Chef, je n'ai pas retrouvé l'avis original, mais voici une suggestion basée sur votre message :\n\n${v2}`;
        await sendWhatsAppMessage(fromPhone, fallbackMsg);
        console.log('[whatsapp-reply] Fallback sans DB - suggestion envoyée');
        return;
      }

      if (isApproval(instruction)) {
        const textToPublish = (review.ai_response ?? '').trim();
        if (!textToPublish) {
          await sendWhatsAppMessage(
            fromPhone,
            "Aucune réponse à valider. Envoyez une instruction pour générer une modification."
          );
          return;
        }
        if (supabase && reviewId) {
          await supabase
            .from('reviews')
            .update({ response_text: textToPublish, status: 'scheduled' })
            .eq('id', reviewId)
            .eq('user_id', review.user_id);
        }
        await sendWhatsAppMessage(fromPhone, "✅ Réponse validée ! Elle sera publiée prochainement.");
        return;
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
    } catch (err) {
      console.error('[whatsapp-reply] Erreur traitement:', err);
    }
  })();

  return twimlResponse();
}
