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
  const suggestedReplyVal = String(suggestedReply ?? '').trim() || '(Aucune suggestion)';
  const suggestedReplyForTemplate =
    suggestedReplyVal.length > 500 ? `${suggestedReplyVal.slice(0, 500)}...` : suggestedReplyVal;

  console.log('Variables envoyées à Twilio:', {
    authorName,
    reviewText,
    suggestedReply: suggestedReplyForTemplate,
  });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappNumberRaw =
    process.env.TWILIO_WHATSAPP_NUMBER ?? process.env.TWILIO_WHATSAPP_FROM ?? '';
  const whatsappNumber = String(whatsappNumberRaw).replace(/^whatsapp:/, '').trim();
  const contentSid =
    process.env.TWILIO_WHATSAPP_ALERT_CONTENT_SID ?? 'HX064e5d92f7e039ecb2b39d775ab28b33';

  console.log('DEBUG CONTENT SID:', process.env.TWILIO_WHATSAPP_ALERT_CONTENT_SID ?? '(fallback)');

  if (!accountSid || !authToken || !whatsappNumber) {
    return {
      success: false,
      error:
        'Twilio non configuré. Définissez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_WHATSAPP_NUMBER (ou TWILIO_WHATSAPP_FROM).',
    };
  }

  const toFormatted = normalizePhone(to);
  const toWithPlus = toFormatted.startsWith('+') ? toFormatted : `+${toFormatted}`;
  const toWhatsApp = `whatsapp:${toWithPlus}`;
  const fromWhatsApp = `whatsapp:${whatsappNumber.startsWith('+') ? whatsappNumber : '+' + whatsappNumber}`;

  try {
    const client = twilio(accountSid, authToken);

    if (contentSid) {
      const message = await client.messages.create({
        from: fromWhatsApp,
        to: toWhatsApp,
        contentSid,
        contentVariables: JSON.stringify({
          '1': authorName || 'Inconnu',
          '2': reviewText || 'Pas de texte',
          '3': suggestedReplyForTemplate || 'Pas de suggestion',
        }),
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
      `"${suggestedReplyForTemplate}"`,
      ``,
      `Répondez 'OK' pour valider cette réponse ou envoyez un vocal pour la modifier.`,
      ``,
      `_Propulsé par Reputexa AI_`,
    ]
      .filter(Boolean)
      .join('\n');

    const message = await client.messages.create({
      body,
      from: fromWhatsApp,
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
