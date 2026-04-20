/**
 * Fusion profonde : la locale demandée surcharge le défaut (ex. fr) pour les clés manquantes.
 * Partagé entre next-intl (request) et e-mails serveur.
 *
 * **Structure = celle du défaut uniquement** : toute clé présente dans la locale mais absente
 * de l’arbre `defaultMessages` est ignorée (évite les doublons / mauvaise imbrication après
 * des exports Babel partiels ou erronés).
 */
export function mergeMessagesDeep(
  defaultMessages: Record<string, unknown>,
  localeMessages: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(defaultMessages)) {
    const localeVal = localeMessages[key];
    const defaultVal = defaultMessages[key];
    if (
      localeVal != null &&
      typeof localeVal === 'object' &&
      !Array.isArray(localeVal) &&
      typeof defaultVal === 'object' &&
      defaultVal != null &&
      !Array.isArray(defaultVal)
    ) {
      merged[key] = mergeMessagesDeep(
        defaultVal as Record<string, unknown>,
        localeVal as Record<string, unknown>
      );
    } else if (localeVal !== undefined && localeVal !== '') {
      merged[key] = localeVal;
    } else {
      merged[key] = defaultVal;
    }
  }
  return merged;
}
