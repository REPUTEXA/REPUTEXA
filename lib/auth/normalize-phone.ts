/**
 * Normalise un numéro de téléphone vers le format E.164 pour la comparaison d'unicité.
 * Utilise la même logique que can-contact.ts / normalizePhone.
 */
export function normalizePhoneForUniqueness(phone: string): string {
  let s = phone.trim();
  if (s.startsWith('00')) s = '+' + s.slice(2);
  const hasPlus = s.startsWith('+');
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return '+33' + digits.slice(1);
  if (digits.length === 9 && (digits.startsWith('6') || digits.startsWith('7'))) return '+33' + digits;
  if (hasPlus || digits.length > 10) return '+' + digits;
  return '+' + digits;
}
