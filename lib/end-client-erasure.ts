import type { CountryCode } from 'libphonenumber-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashPhoneForConsent } from '@/lib/consent-log';
import { parseToE164 } from '@/lib/phone/normalize-e164';

export type EndClientErasureCounts = {
  review_queue: number;
  blacklist: number;
  consent_logs: number;
  contact_history: number;
};

/**
 * Supprime les traces liées au numéro (clients finaux, traitement en qualité de sous-traitant).
 * — review_queue : numéro en clair (E.164) ou empreinte après anonymisation RGPD ;
 * — blacklist / contact_history : numéro normalisé ;
 * — consent_logs : phone_hash (SHA-256 du numéro normalisé).
 */
export async function purgeEndClientDataByPhone(
  rawPhone: string,
  defaultCountry: CountryCode = 'FR'
): Promise<EndClientErasureCounts> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error('SERVICE_UNAVAILABLE');
  }

  const normalized = parseToE164(rawPhone, defaultCountry);
  if (!normalized) {
    throw new Error('INVALID_PHONE');
  }

  const hash = hashPhoneForConsent(normalized);

  let reviewQueue = 0;
  for (const phoneVal of [normalized, hash]) {
    const { data } = await admin.from('review_queue').delete().eq('phone', phoneVal).select('id');
    reviewQueue += data?.length ?? 0;
  }

  const { data: blRows } = await admin.from('blacklist').delete().eq('phone', normalized).select('id');
  const blacklist = blRows?.length ?? 0;

  const { data: clRows } = await admin.from('consent_logs').delete().eq('phone_hash', hash).select('id');
  const consent_logs = clRows?.length ?? 0;

  const { data: chRows } = await admin.from('contact_history').delete().eq('phone', normalized).select('id');
  const contact_history = chRows?.length ?? 0;

  return {
    review_queue: reviewQueue,
    blacklist,
    consent_logs,
    contact_history,
  };
}
