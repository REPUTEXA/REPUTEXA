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
 * Vérifie cooldown resollicitation + blacklist avant envoi. Enregistre le contact si envoyé.
 */
export async function sendOptInMessage(input: SendOptInInput): Promise<{
  sent: boolean;
  reason?: 'blacklist' | 'solicitation_cooldown' | 'error';
  error?: string;
}> {
  const { ok, reason } = await canContactPhone(input.userId, input.phone);
  if (!ok) return { sent: false, reason: reason ?? 'solicitation_cooldown' };

  const authorName = (input.authorName || input.establishmentName || 'L\'équipe').trim();
  const msg =
    `Bonjour — ici ${authorName}. On espère que votre passage vous a plu ; surtout, on veut *mieux vous servir*.\n\n` +
    `Si vous aviez une minute pour nous dire ce qui a été bien ou ce qu’on peut ajuster, ça nous aide vraiment.\n\n` +
    `Répondez *Oui* pour continuer, *Non* si vous préférez qu’on ne vous sollicite pas sur ce sujet.`;

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
