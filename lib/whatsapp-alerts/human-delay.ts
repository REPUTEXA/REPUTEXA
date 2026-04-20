/**
 * Moteur de délai humain — simule une frappe/réflexion humaine avant envoi WhatsApp.
 *
 * Formule :
 *   Frappe      = ceil(nb_chars / 3) secondes  (3 chars/sec, vitesse smartphone)
 *   Réflexion   = 5–10 secondes aléatoires
 *   Cap maximal = 25 secondes (évite les timeouts webhook)
 *
 * Pour Meta Cloud API : envoie un statut "read" sur le dernier message entrant
 * (montre les coches bleues, signale au client que le message est traité).
 * Twilio n'expose pas d'API de typing natif — le délai suffit.
 */

const MAX_DELAY_S = 25;

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Calcule le délai en ms en fonction de la longueur du message à envoyer.
 * Plus le message est long, plus le "temps de frappe" est réaliste.
 */
export function calculateDelayMs(message: string): number {
  const chars = message.trim().length;
  const typingSeconds    = Math.ceil(chars / 3);   // 3 chars/sec
  const reflectionSeconds = randomInt(5, 10);       // temps de réflexion
  const totalSeconds     = Math.min(typingSeconds + reflectionSeconds, MAX_DELAY_S);
  return totalSeconds * 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Signale à Meta Cloud API que le dernier message entrant a été lu.
 * Affiche les coches bleues côté client — meilleure approximation disponible
 * d'un "typing indicator" via l'API publique WhatsApp Business.
 *
 * @param incomingMessageId - wamid du dernier message reçu (optionnel)
 */
async function sendMetaReadStatus(
  phoneNumberId: string,
  accessToken: string,
  incomingMessageId: string,
): Promise<void> {
  try {
    await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: incomingMessageId,
      }),
    });
  } catch {
    // Non-fatal — le délai reste respecté
  }
}

/**
 * Simule un délai de frappe + réflexion humaine avant l'envoi d'un message WhatsApp.
 *
 * @param messageToSend    - Texte du message à envoyer (calcul du délai de frappe)
 * @param recipientPhone   - Numéro E.164 du destinataire (optionnel, pour typing Meta)
 * @param incomingMsgId    - ID du message entrant Meta (optionnel, pour statut "read")
 */
export async function calculateHumanDelay(
  messageToSend: string,
  recipientPhone?: string,
  incomingMsgId?: string,
): Promise<void> {
  const delayMs = calculateDelayMs(messageToSend);

  // ── Meta Cloud API : statut "lu" avant envoi ────────────────────────────────
  const metaPhoneId = process.env.WHATSAPP_META_PHONE_NUMBER_ID;
  const metaToken   = process.env.WHATSAPP_META_ACCESS_TOKEN;

  if (metaPhoneId && metaToken && incomingMsgId) {
    await sendMetaReadStatus(metaPhoneId, metaToken, incomingMsgId);
  }

  void recipientPhone; // réservé pour future extension typing indicator

  // ── Pause humaine ────────────────────────────────────────────────────────────
  await sleep(delayMs);
}
