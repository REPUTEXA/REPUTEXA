import { sendWhatsAppMessage } from '@/lib/whatsapp-alerts/send-whatsapp-message';
import { canContactPhone, recordContact, normalizePhone } from './can-contact';
import { createAdminClient } from '@/lib/supabase/admin';

export interface SendOptInInput {
  userId: string;
  phone: string;
  establishmentName?: string;
  /** Prénom de l'établissement ou du responsable (ex: "L'équipe du Bistro") */
  authorName?: string;
}

/**
 * Envoie le message opt-in initial du flux Zenith Capture.
 * Vérifie 90 jours + blacklist avant envoi. Enregistre le contact si envoyé.
 */
export async function sendOptInMessage(input: SendOptInInput): Promise<{
  sent: boolean;
  reason?: 'blacklist' | 'contacted_90_days' | 'error';
  error?: string;
}> {
  const { ok, reason } = await canContactPhone(input.userId, input.phone);
  if (!ok) return { sent: false, reason: reason ?? 'contacted_90_days' };

  const authorName = (input.authorName || input.establishmentName || 'L\'équipe').trim();
  const msg =
    `Bonjour ! C'est ${authorName}. On espère que vous avez passé un bon moment. ` +
    `Seriez-vous d'accord pour nous dire ce que vous en avez pensé ?`;

  const result = await sendWhatsAppMessage(input.phone, msg);
  if (!result.success) return { sent: false, reason: 'error', error: result.error };

  await recordContact(input.userId, input.phone);

  const supabase = createAdminClient();
  if (supabase) {
    const normalized = normalizePhone(input.phone);
    await supabase.from('whatsapp_capture_session').insert({
      user_id: input.userId,
      phone: normalized,
      state: 'opt_in_sent',
    });
  }

  return { sent: true };
}
