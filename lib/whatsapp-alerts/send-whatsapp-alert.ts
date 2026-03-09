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

  const commentTrunc = comment.length > 150 ? `${comment.slice(0, 150)}...` : comment;
  const replyTrunc = suggestedReply.length > 200 ? `${suggestedReply.slice(0, 200)}...` : suggestedReply;

  const contentVariables: Record<string, string> = {
    '1': establishmentName ?? 'Établissement',
    '2': reviewerName,
    '3': String(rating),
    '4': commentTrunc,
    '5': replyTrunc,
  };

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
  const contentSid = process.env.TWILIO_WHATSAPP_ALERT_CONTENT_SID;

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

    if (contentSid) {
      const message = await client.messages.create({
        contentSid,
        contentVariables: JSON.stringify(contentVariables),
        from: fromFormatted,
        to: toWhatsApp,
      });
      return { success: true, messageId: message.sid };
    }

    const body = [
      `🚨 *ALERTE NOUVEL AVIS NÉGATIF*`,
      ``,
      establishmentName ? `📌 ${establishmentName}` : null,
      `👤 ${reviewerName} — ${rating}/5 ⭐`,
      ``,
      `📝 *Avis client :*`,
      `"${commentTrunc}"`,
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

export { CALLBACK_ACTIONS };
