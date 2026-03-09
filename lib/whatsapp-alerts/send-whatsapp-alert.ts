import twilio from 'twilio';
import type { WhatsAppAlertPayload } from './types';
import { CALLBACK_ACTIONS } from './types';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) return `+33${digits.slice(1)}`;
  if (digits.startsWith('33') && digits.length === 11) return `+${digits}`;
  return digits.startsWith('+') ? phone : `+${digits}`;
}

/**
 * Envoie une alerte WhatsApp via Twilio.
 *
 * Si TWILIO_WHATSAPP_ALERT_CONTENT_SID est défini : utilise le template Content API (avec boutons).
 * Sinon : envoie un message texte simple (fonctionne avec le Sandbox pour les tests).
 *
 * Variables d'environnement : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 * TWILIO_WHATSAPP_FROM, TWILIO_WHATSAPP_ALERT_CONTENT_SID (optionnel)
 */
export async function sendWhatsAppAlert(
  payload: WhatsAppAlertPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    to,
    reviewerName,
    rating,
    comment,
    suggestedReply,
    establishmentName,
  } = payload;

  const authorName = String(reviewerName ?? '').trim() || 'Client';
  const reviewText = comment?.trim()
    ? comment.length > 300
      ? `${comment.slice(0, 300).trim()}...`
      : comment.trim()
    : '(Aucun commentaire)';
  const replyForTemplate = String(suggestedReply ?? '').trim() || '(Aucune suggestion)';
  const replyTrunc =
    replyForTemplate.length > 500 ? `${replyForTemplate.slice(0, 500)}...` : replyForTemplate;

  const contentVariables = {
    '1': authorName,
    '2': reviewText,
    '3': replyTrunc,
  };

  console.log('Variables envoyées à Twilio:', {
    authorName,
    reviewText: reviewText.slice(0, 80) + (reviewText.length > 80 ? '...' : ''),
    suggestedReply: replyTrunc.slice(0, 80) + (replyTrunc.length > 80 ? '...' : ''),
  });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
  const contentSid =
    process.env.TWILIO_WHATSAPP_ALERT_CONTENT_SID ?? 'HX064e5d92f7e039ecb2b39d775ab28b33';

  if (!accountSid || !authToken || !whatsappFrom) {
    return {
      success: false,
      error: 'Twilio non configuré. Définissez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_WHATSAPP_FROM.',
    };
  }

  const toFormatted = normalizePhone(to);
  const toWithPlus = toFormatted.startsWith('+') ? toFormatted : `+${toFormatted}`;
  const fromFormatted = whatsappFrom.startsWith('whatsapp:')
    ? whatsappFrom
    : `whatsapp:${whatsappFrom.replace(/^\+/, '')}`;
  const toWhatsApp = `whatsapp:${toWithPlus}`;

  try {
    const client = twilio(accountSid, authToken);

    // Priorité : Content API (boutons) si TWILIO_WHATSAPP_ALERT_CONTENT_SID est défini
    if (contentSid) {
      const message = await client.messages.create({
        contentSid,
        contentVariables: JSON.stringify({ '1': authorName, '2': reviewText, '3': replyTrunc }),
        from: fromFormatted,
        to: toWhatsApp,
      });
      return { success: true, messageId: message.sid };
    }

    const body = [
      `🚨 *ALERTE NOUVEL AVIS NÉGATIF*`,
      ``,
      establishmentName ? `📌 ${establishmentName}` : null,
      `👤 ${authorName} — ${rating}/5 ⭐`,
      ``,
      `📝 *Avis client :*`,
      `"${reviewText}"`,
      ``,
      `🤖 *Suggestion de réponse IA :*`,
      `"${replyTrunc}"`,
      ``,
      `Répondez 'OK' pour valider cette réponse ou envoyez un vocal pour la modifier.`,
      ``,
      `_Propulsé par Reputexa AI_`,
    ]
      .filter(Boolean)
      .join('\n');

    const message = await client.messages.create({
      body,
      from: fromFormatted,
      to: toWhatsApp,
    });

    return { success: true, messageId: message.sid };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[sendWhatsAppAlert] Twilio error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Renvoie la carte interactive (Content API) avec une nouvelle suggestion.
 * Utilisé après une modification vocale pour permettre de modifier à nouveau ou valider.
 */
export async function sendWhatsAppInteractiveCard(params: {
  to: string;
  reviewerName: string;
  comment: string;
  suggestedReply: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendWhatsAppAlert({
    to: params.to,
    reviewId: 'resend', // non utilisé pour l'envoi
    reviewerName: params.reviewerName,
    rating: 1,
    comment: params.comment,
    suggestedReply: params.suggestedReply,
  });
}

export { CALLBACK_ACTIONS };
