import { createAdminClient } from '@/lib/supabase/admin';

export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) digits = '33' + digits.slice(1);
  if (digits.startsWith('33') && digits.length === 11) digits = digits;
  return digits;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Vérifie si on peut contacter ce numéro (anti-spam 90 jours + blacklist RGPD).
 */
export async function canContactPhone(
  userId: string,
  phone: string
): Promise<{ ok: boolean; reason?: 'blacklist' | 'contacted_90_days' }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, reason: 'contacted_90_days' };

  const normalized = normalizePhone(phone);

  const { data: blacklisted } = await supabase
    .from('blacklist')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', normalized)
    .maybeSingle();

  if (blacklisted) return { ok: false, reason: 'blacklist' };

  const since = new Date(Date.now() - NINETY_DAYS_MS).toISOString();
  const { data: recent } = await supabase
    .from('contact_history')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', normalized)
    .gte('contacted_at', since)
    .limit(1)
    .maybeSingle();

  if (recent) return { ok: false, reason: 'contacted_90_days' };

  return { ok: true };
}

/**
 * Enregistre un contact (appelé après envoi du message opt-in).
 */
export async function recordContact(userId: string, phone: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  const normalized = normalizePhone(phone);
  await supabase.from('contact_history').insert({
    user_id: userId,
    phone: normalized,
  });
}

/**
 * Ajoute un numéro à la blacklist (client a répondu Non/Stop).
 */
export async function addToBlacklist(userId: string, phone: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;
  const normalized = normalizePhone(phone);
  await supabase
    .from('blacklist')
    .upsert(
      { user_id: userId, phone: normalized },
      { onConflict: 'user_id,phone', ignoreDuplicates: true }
    );
}
