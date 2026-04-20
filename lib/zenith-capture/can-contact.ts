import { createAdminClient } from '@/lib/supabase/admin';
import { SOLICITATION_COOLDOWN_REASON, solicitationCooldownCutoffIso } from '@/lib/zenith-capture/policy';

/**
 * Normalise un numéro de téléphone vers le format E.164 (+XXXXXXXXXXX).
 * Compatible avec tous les formats reçus par le webhook ou la caisse :
 *
 *   "0612345678"      → "+33612345678"   (local FR 06/07)
 *   "06 12 34 56 78"  → "+33612345678"   (avec espaces)
 *   "0033612345678"   → "+33612345678"   (double zéro international)
 *   "33612345678"     → "+33612345678"   (sans + mais déjà code pays)
 *   "+33612345678"    → "+33612345678"   (déjà E.164)
 *   "612345678"       → "+33612345678"   (9 chiffres FR sans le 0)
 *   "+34612345678"    → "+34612345678"   (autre pays, conservé tel quel)
 */
export function normalizePhone(raw: string): string {
  let s = raw.trim();

  // Préfixe "00XX" → "+XX"
  if (s.startsWith('00')) s = '+' + s.slice(2);

  const hasPlus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');

  // Numéro local français : 10 chiffres commençant par 0 (06, 07, 01…)
  if (digits.length === 10 && digits.startsWith('0')) {
    return '+33' + digits.slice(1);
  }

  // Numéro court français sans le 0 initial : 9 chiffres, commence par 6 ou 7
  if (digits.length === 9 && (digits.startsWith('6') || digits.startsWith('7'))) {
    return '+33' + digits;
  }

  // Format international déjà présent (avec ou sans '+')
  if (hasPlus || digits.length > 10) {
    return '+' + digits;
  }

  // Fallback : on préfixe quand même avec '+'
  return '+' + digits;
}

/**
 * Vérifie si on peut lancer une nouvelle campagne de sollicitation pour ce numéro
 * (cooldown 120 j + liste noire STOP / opposition).
 */
export async function canContactPhone(
  userId: string,
  phone: string
): Promise<{ ok: boolean; reason?: 'blacklist' | typeof SOLICITATION_COOLDOWN_REASON }> {
  const supabase = createAdminClient();
  if (!supabase) return { ok: false, reason: SOLICITATION_COOLDOWN_REASON };

  const normalized = normalizePhone(phone);

  const { data: blacklisted } = await supabase
    .from('blacklist')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', normalized)
    .maybeSingle();

  if (blacklisted) return { ok: false, reason: 'blacklist' };

  const since = solicitationCooldownCutoffIso();
  const { data: recent } = await supabase
    .from('contact_history')
    .select('id')
    .eq('user_id', userId)
    .eq('phone', normalized)
    .gte('contacted_at', since)
    .limit(1)
    .maybeSingle();

  if (recent) return { ok: false, reason: SOLICITATION_COOLDOWN_REASON };

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
