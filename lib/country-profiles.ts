/**
 * Profils de pays pour l'adaptation culturelle du Sniper
 * Chaque pays a un ton et une devise pour personnaliser les pitchs IA
 */
export type CountryProfile = {
  tone: string;
  currency: string;
  locale: string;
};

export const countryProfiles: Record<string, CountryProfile> = {
  US: { tone: 'aggressive/roi', currency: 'USD', locale: 'en-US' },
  FR: { tone: 'protective/quality', currency: 'EUR', locale: 'fr-FR' },
  JP: { tone: 'formal/respect', currency: 'JPY', locale: 'ja-JP' },
  DE: { tone: 'precise/efficiency', currency: 'EUR', locale: 'de-DE' },
  ES: { tone: 'warm/trust', currency: 'EUR', locale: 'es-ES' },
  IT: { tone: 'warm/heritage', currency: 'EUR', locale: 'it-IT' },
  GB: { tone: 'professional/authority', currency: 'GBP', locale: 'en-GB' },
  AE: { tone: 'premium/excellence', currency: 'AED', locale: 'ar-AE' },
  MX: { tone: 'warm/personal', currency: 'MXN', locale: 'es-MX' },
  BR: { tone: 'enthusiastic/growth', currency: 'BRL', locale: 'pt-BR' },
};

export const DEFAULT_PROFILE: CountryProfile = {
  tone: 'professional/warm',
  currency: 'EUR',
  locale: 'fr-FR',
};

export function getCountryProfile(countryCode: string | null | undefined): CountryProfile {
  if (!countryCode) return DEFAULT_PROFILE;
  const upper = countryCode.toUpperCase();
  return countryProfiles[upper] ?? DEFAULT_PROFILE;
}
