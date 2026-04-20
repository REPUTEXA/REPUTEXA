import twilio from 'twilio';
import { finalizeWhatsappOutboundText } from '@/lib/whatsapp-alerts/humanizer-whatsapp';

/**
 * Envoie un message texte WhatsApp simple (réponse à l'utilisateur).
 * Pièces jointes optionnelles (audio, image) via `mediaUrls`.
 */
export async function sendWhatsAppMessage(
  to: string,
  body: string,
  mediaUrls?: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !whatsappFrom) {
    return {
      success: false,
      error: 'Twilio non configuré',
    };
  }

  const toDigits = to.replace(/\D/g, '');
  const toFormatted = toDigits.startsWith('0') && toDigits.length === 10
    ? `+33${toDigits.slice(1)}`
    : toDigits.startsWith('33')
      ? `+${toDigits}`
      : to.startsWith('+')
        ? to
        : `+${toDigits}`;
  const toWhatsApp = toFormatted.startsWith('whatsapp:') ? toFormatted : `whatsapp:${toFormatted}`;
  const fromFormatted = whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom.replace(/^\+/, '')}`;
  const finalized = finalizeWhatsappOutboundText(body);
  const media = (mediaUrls ?? []).map((u) => u.trim()).filter((u) => u.length > 0 && /^https?:\/\//i.test(u)).slice(0, 3);
  const bodyOut = finalized.length > 0 ? finalized : media.length > 0 ? ' ' : '';

  if (bodyOut.length < 1) {
    return { success: false, error: 'Message vide' };
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      body: bodyOut,
      mediaUrl: media.length > 0 ? media : undefined,
      from: fromFormatted,
      to: toWhatsApp,
    });
    return { success: true, messageId: message.sid };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}
