import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/**
 * Valide et convertit un numéro saisi (national ou international) en E.164.
 * Essaie d’abord avec le pays par défaut, puis en format international seul.
 */
export function parseToE164(raw: string, defaultCountry: CountryCode = 'FR'): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let pn = parsePhoneNumberFromString(s, defaultCountry);
  if (pn?.isValid()) return pn.format('E.164');
  pn = parsePhoneNumberFromString(s);
  if (pn?.isValid()) return pn.format('E.164');
  return null;
}
