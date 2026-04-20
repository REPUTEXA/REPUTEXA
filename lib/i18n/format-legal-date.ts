/** Date d’effet document légal — rendu lisible selon locale UI (UTC). */
const BCP47: Record<string, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
};

export function formatLegalEffectiveDate(isoDate: string, locale: string): string {
  const tag = BCP47[locale] ?? 'en-GB';
  try {
    return new Date(isoDate).toLocaleDateString(tag, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return isoDate;
  }
}
