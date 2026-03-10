/**
 * Utilitaires pour le décompte des jours d'essai.
 * Le calcul utilise new Date() : à chaque chargement de page, le décompte est recalculé.
 */

/**
 * Calcule le nombre de jours restants avant la fin de l'essai.
 * @param endDate - Date de fin d'essai (trial_ends_at)
 * @returns Nombre entier (14, 13, 12... 0). 0 = dernier jour ou essai expiré.
 */
export function getRemainingTrialDays(endDate: Date | string | null | undefined): number {
  if (!endDate) return 0;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  if (Number.isNaN(end.getTime())) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  const diffMs = endDay.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

const LOCALE_MAP: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
};

/**
 * Formate la date de fin d'essai selon la locale de l'utilisateur.
 */
export function formatTrialEndDate(
  endDate: Date | string | null | undefined,
  locale: string
): string {
  if (!endDate) return '';
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  if (Number.isNaN(end.getTime())) return '';
  const fmtLocale = LOCALE_MAP[locale] ?? 'fr-FR';
  return end.toLocaleDateString(fmtLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
