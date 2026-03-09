import twilio from 'twilio';

/**
 * Envoie un message texte WhatsApp simple (réponse à l'utilisateur).
 */
export async function sendWhatsAppMessage(
  to: string,
  body: string
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

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      body,
      from: fromFormatted,
      to: toWhatsApp,
    });
    return { success: true, messageId: message.sid };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return { success: false, error: err.message };
  }
}
