import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export type ConsentType = 'yes' | 'no' | 'stop';

/** Empreinte SHA-256 alignée sur les crons RGPD (review_queue). */
export function hashPhoneForConsent(phone: string): string {
  return crypto.createHash('sha256').update(phone.trim()).digest('hex');
}

/**
 * Enregistre un consentement / refus / STOP WhatsApp pour audit RGPD.
 * Silencieux en cas d’échec (ne doit pas bloquer le webhook).
 */
export async function insertConsentLog(params: {
  merchantId: string;
  reviewQueueId: string | null;
  phone: string;
  consentType: ConsentType;
  messagePreview?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn('[consent-log] Admin client indisponible — trace non enregistrée');
    return;
  }

  const phone_hash = hashPhoneForConsent(params.phone);
  const preview =
    params.messagePreview && params.messagePreview.length > 500
      ? `${params.messagePreview.slice(0, 497)}...`
      : params.messagePreview ?? null;

  const { error } = await admin.from('consent_logs').insert({
    merchant_id: params.merchantId,
    review_queue_id: params.reviewQueueId,
    phone_hash,
    consent_type: params.consentType,
    channel: 'whatsapp',
    message_preview: preview,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error('[consent-log] Insert échoué:', error.message);
  }
}
