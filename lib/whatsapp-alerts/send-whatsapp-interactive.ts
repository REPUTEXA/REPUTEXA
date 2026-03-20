/**
 * Envoi de messages WhatsApp interactifs (boutons de réponse rapide).
 *
 * Stratégie :
 *  - Si WHATSAPP_META_PHONE_NUMBER_ID + WHATSAPP_META_ACCESS_TOKEN sont définis
 *    → Meta Cloud API (boutons natifs "button_reply")
 *  - Sinon → Twilio (message texte formaté avec instructions 'P' / 'M')
 *
 * Meta doc : https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons
 */

import twilio from 'twilio';

export type QuickReplyButton = {
  /** Identifiant renvoyé dans le postback (max 256 chars). ex: 'publish_review_id:uuid' */
  id: string;
  /** Texte du bouton visible par l'utilisateur (max 20 chars). ex: '✅ Publier' */
  title: string;
};

export type SendResult = {
  success: boolean;
  messageId?: string;
  provider?: 'meta' | 'twilio_text';
  error?: string;
};

// ── Meta Cloud API ─────────────────────────────────────────────────────────────

interface MetaInteractivePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button';
    body: { text: string };
    action: {
      buttons: Array<{
        type: 'reply';
        reply: { id: string; title: string };
      }>;
    };
  };
}

async function sendViaMetaAPI(
  to: string,
  bodyText: string,
  buttons: QuickReplyButton[]
): Promise<SendResult> {
  const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_META_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'Meta Cloud API non configurée.' };
  }

  // Supprimer le préfixe '+' pour Meta (attend un numéro sans '+')
  const toClean = to.startsWith('+') ? to.slice(1) : to;

  // Meta accepte max 3 boutons, on tronque si nécessaire
  const cappedButtons = buttons.slice(0, 3);

  const payload: MetaInteractivePayload = {
    messaging_product: 'whatsapp',
    to: toClean,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: cappedButtons.map((btn) => ({
          type: 'reply',
          reply: {
            id: btn.id.slice(0, 256),
            title: btn.title.slice(0, 20),
          },
        })),
      },
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  const json = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };

  if (!res.ok) {
    return { success: false, error: json.error?.message ?? `Meta API ${res.status}` };
  }

  return {
    success: true,
    messageId: json.messages?.[0]?.id,
    provider: 'meta',
  };
}

// ── Twilio text fallback ───────────────────────────────────────────────────────

/**
 * Twilio ne supporte pas nativement les boutons interactifs sans ContentSid.
 * On envoie un message texte bien formaté avec des instructions claires.
 * Le webhook gère les réponses 'P' (publier) et 'M' (modifier).
 */
async function sendViaTwilioText(
  to: string,
  bodyText: string,
  buttons: QuickReplyButton[]
): Promise<SendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !whatsappFrom) {
    return { success: false, error: 'Twilio non configuré.' };
  }

  // Construire les options de réponse lisibles
  const optionsLines = buttons
    .map((btn, i) => {
      const key = btn.id.startsWith('publish') ? 'P' : btn.id.startsWith('modify') ? 'M' : String(i + 1);
      return `Tapez *${key}* → ${btn.title}`;
    })
    .join('\n');

  const fullBody = `${bodyText}\n\n${optionsLines}`;

  const toDigits = to.replace(/\D/g, '');
  const toFormatted = toDigits.startsWith('0') && toDigits.length === 10
    ? `+33${toDigits.slice(1)}`
    : toDigits.startsWith('33') ? `+${toDigits}` : to.startsWith('+') ? to : `+${toDigits}`;
  const toWhatsApp = toFormatted.startsWith('whatsapp:') ? toFormatted : `whatsapp:${toFormatted}`;
  const fromFormatted = whatsappFrom.startsWith('whatsapp:')
    ? whatsappFrom
    : `whatsapp:${whatsappFrom.replace(/^\+/, '')}`;

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({ body: fullBody, from: fromFormatted, to: toWhatsApp });
    return { success: true, messageId: message.sid, provider: 'twilio_text' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Envoie un message WhatsApp interactif avec des boutons de réponse rapide.
 *
 * Auto-détecte le provider :
 * - Meta Cloud API si WHATSAPP_META_PHONE_NUMBER_ID + WHATSAPP_META_ACCESS_TOKEN
 * - Twilio texte formaté sinon
 */
export async function sendWhatsAppInteractive(
  to: string,
  bodyText: string,
  buttons: QuickReplyButton[]
): Promise<SendResult> {
  const hasMetaConfig =
    !!process.env.WHATSAPP_META_PHONE_NUMBER_ID &&
    !!process.env.WHATSAPP_META_ACCESS_TOKEN;

  if (hasMetaConfig) {
    return sendViaMetaAPI(to, bodyText, buttons);
  }

  return sendViaTwilioText(to, bodyText, buttons);
}
