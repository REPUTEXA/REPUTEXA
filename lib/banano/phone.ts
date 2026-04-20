import type { CountryCode } from 'libphonenumber-js';
import { parseToE164 } from '@/lib/phone/normalize-e164';

/**
 * Valide via libphonenumber-js et renvoie l’E.164, ou null si invalide.
 * @param defaultCountry — pays pour les saisies nationales (imports FR, etc.).
 */
export function normalizePhoneE164(raw: string, defaultCountry: CountryCode = 'FR'): string | null {
  const d = String(raw ?? '').trim();
  if (!d) return null;
  return parseToE164(d, defaultCountry);
}

/** Colonne « téléphone » d’un export : même règles que {@link normalizePhoneE164}. */
export function sanitizeImportPhoneColumn(raw: string): string | null {
  return normalizePhoneE164(raw);
}
