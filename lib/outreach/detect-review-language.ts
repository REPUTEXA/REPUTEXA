/**
 * Heuristique légère sur l’extrait d’avis (pas un classifieur ML).
 * Utilisé pour méta-données / ton ; la langue marché reste `GrowthCountryConfig.localeDefault`.
 */
export function detectReviewLanguage(
  text: string | null | undefined,
  fallbackLocale: string
): string {
  if (!text?.trim()) return fallbackLocale.slice(0, 2).toLowerCase();
  const t = text.slice(0, 800).toLowerCase();

  if (/[àèéìòù]| che | non | però | ristorante | servizio | cibo | locale /i.test(t)) {
    return 'it';
  }
  if (/¿|¡|\bel\b|\bla\b|\blos\b|\bmuy\b|\bservicio\b|\bcomida\b/i.test(t)) {
    return 'es';
  }
  if (/[äöüß]|\b und \b|\b der \b|\b die \b|\b das \b|\bwartezeit\b|\bservice\b/i.test(t)) {
    return 'de';
  }
  if (/\bthe\b|\band\b|\bwas\b|\bvery\b|\bservice\b|\bfood\b|\bwait\b/i.test(t)) {
    return 'en';
  }
  if (
    /\b(le|la|les|un|une|des|très|service|repas|attente|déçu|déçue|nul|super)\b/i.test(t)
  ) {
    return 'fr';
  }

  return fallbackLocale.slice(0, 2).toLowerCase();
}
