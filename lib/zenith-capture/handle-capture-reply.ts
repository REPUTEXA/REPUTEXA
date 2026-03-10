import { createAdminClient } from '@/lib/supabase/admin';
import { transcribeAudioFromUrl } from '@/lib/whisper';
import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import { addToBlacklist } from './can-contact';
import { buildSeoAvis } from './build-seo-avis';
import { classifyFeedback } from './classify-feedback';

function isOptOut(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === 'non' || t === 'non.' || t === 'stop' || t === 'n\'importe';
}

function isOptIn(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === 'oui' ||
    t === 'ouai' ||
    t === 'ok' ||
    t === 'd\'accord' ||
    t === 'yes' ||
    t === 'si'
  );
}

function isModifyRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.includes('modifier') || t.includes('change') || t.includes('corriger');
}

function isPublishRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t === 'publier' ||
    t === 'publie' ||
    t === 'ok' ||
    t === 'valider' ||
    t === 'publish' ||
    t === 'oui'
  );
}

export interface HandleCaptureReplyInput {
  fromPhone: string;
  normalizedPhone: string;
  /** Texte déjà transcrit (vocal) ou body */
  text: string;
  mediaUrl?: string;
  twilioAuth?: { accountSid: string; authToken: string };
}

/**
 * Traite une réponse dans le flux Zenith Capture.
 * Retourne true si le message a été traité (flux Capture), false sinon.
 */
export async function handleCaptureReply(
  input: HandleCaptureReplyInput
): Promise<boolean> {
  const supabase = createAdminClient();
  if (!supabase) return false;

  const { data: session } = await supabase
    .from('whatsapp_capture_session')
    .select('id, user_id, state, raw_feedback, draft_review_text')
    .eq('phone', input.normalizedPhone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return false;

  let text = input.text?.trim() ?? '';
  if (!text && input.mediaUrl && input.twilioAuth) {
    try {
      text = await transcribeAudioFromUrl(input.mediaUrl, {
        twilioAuth: input.twilioAuth,
        language: 'fr',
      });
    } catch {
      await sendWhatsAppMessage(
        input.fromPhone,
        "On n'a pas pu transcrire le vocal. Réessayez ou envoyez un texto !"
      );
      return true;
    }
  }

  if (!text?.trim()) {
    await sendWhatsAppMessage(
      input.fromPhone,
      "Envoyez du texte, un vocal ou une photo pour nous dire ce que vous en avez pensé."
    );
    return true;
  }

  const trimmed = text.trim();

  // --- State: opt_in_sent ---
  if (session.state === 'opt_in_sent') {
    if (isOptOut(trimmed)) {
      await addToBlacklist(session.user_id, input.normalizedPhone);
      await supabase
        .from('whatsapp_capture_session')
        .update({ state: 'closed', updated_at: new Date().toISOString() })
        .eq('id', session.id);
      await sendWhatsAppMessage(
        input.fromPhone,
        "Pas de souci ! On ne vous recontactera plus pour les avis. Bonne continuation !"
      );
      return true;
    }
    if (isOptIn(trimmed)) {
      await supabase
        .from('whatsapp_capture_session')
        .update({ state: 'collecting', opted_in: true, updated_at: new Date().toISOString() })
        .eq('id', session.id);
      await sendWhatsAppMessage(
        input.fromPhone,
        "Super ! Envoyez-nous votre avis par texto, vocal ou photo. C'est vous qui voyez !"
      );
      return true;
    }
    await sendWhatsAppMessage(
      input.fromPhone,
      "Répondez Oui pour nous donner votre avis, ou Non pour ne plus être contacté."
    );
    return true;
  }

  // --- State: collecting ---
  if (session.state === 'collecting') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('seo_keywords, establishment_name, google_location_address')
      .eq('id', session.user_id)
      .single();

    const seoKeywords = Array.isArray(profile?.seo_keywords)
      ? (profile.seo_keywords as string[]).filter((k): k is string => typeof k === 'string')
      : [];
    const city = (profile?.google_location_address as string | undefined)
      ?.split(',')
      ?.slice(-2)[0]
      ?.trim();

    const draft = await buildSeoAvis({
      feedback: trimmed,
      seoKeywords,
      city,
      establishmentName: profile?.establishment_name ?? undefined,
    });

    await supabase
      .from('whatsapp_capture_session')
      .update({
        state: 'proposition_sent',
        raw_feedback: trimmed,
        draft_review_text: draft,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    await sendWhatsAppMessage(
      input.fromPhone,
      `Voici une proposition d'avis basée sur vos mots :\n\n« ${draft} »\n\nÇa vous va ? Répondez *Modifier* pour changer, ou *Publier* pour le poster sur Google.`
    );
    return true;
  }

  // --- State: proposition_sent ---
  if (session.state === 'proposition_sent') {
    if (isModifyRequest(trimmed)) {
      await supabase
        .from('whatsapp_capture_session')
        .update({
          state: 'collecting',
          draft_review_text: null,
          raw_feedback: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id);
      await sendWhatsAppMessage(
        input.fromPhone,
        "Pas de souci ! Dites-moi ce que vous voulez modifier ou envoyez une nouvelle version."
      );
      return true;
    }
    if (isPublishRequest(trimmed)) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('google_review_url, google_location_id')
        .eq('id', session.user_id)
        .single();

      let reviewUrl = profile?.google_review_url as string | undefined;
      if (!reviewUrl && profile?.google_location_id) {
        reviewUrl = `https://search.google.com/local/writereview?placeid=${profile.google_location_id}`;
      }
      if (!reviewUrl) {
        reviewUrl = 'https://www.google.com/maps';
      }

      await supabase
        .from('whatsapp_capture_session')
        .update({
          state: 'waiting_private_feedback',
          review_published: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      await sendWhatsAppMessage(
        input.fromPhone,
        `Parfait ! Copiez le texte et collez-le ici : ${reviewUrl}\n\nMerci beaucoup ! 🙏`
      );
      await sendWhatsAppMessage(
        input.fromPhone,
        "Entre nous, y a-t-il un petit détail qu'on pourrait améliorer pour votre prochaine visite ?"
      );
      return true;
    }
    await sendWhatsAppMessage(
      input.fromPhone,
      "Répondez *Modifier* ou *Publier* pour continuer."
    );
    return true;
  }

  // --- State: waiting_private_feedback ---
  if (session.state === 'waiting_private_feedback') {
    const classification = await classifyFeedback(trimmed);
    const { data: feedback } = await supabase
      .from('private_feedback')
      .insert({
        user_id: session.user_id,
        feedback_text: trimmed,
        classification,
        phone: input.normalizedPhone,
      })
      .select('id')
      .single();

    await supabase
      .from('whatsapp_capture_session')
      .update({
        state: 'closed',
        private_feedback_id: feedback?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    await sendWhatsAppMessage(
      input.fromPhone,
      "Merci pour votre retour ! On en prend bonne note. À très vite ! 😊"
    );
    return true;
  }

  return true;
}
