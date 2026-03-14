/**
 * Normalise un numéro de téléphone pour la comparaison d'unicité.
 * Utilise la même logique que zenith-capture (0 → 33 pour la France).
 */
export function normalizePhoneForUniqueness(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '33' + digits.slice(1);
  }
  return digits;
}
