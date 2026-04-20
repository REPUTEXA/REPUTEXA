import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

/**
 * Locale des textes générés par les jobs admin internes (digest Council, contexte Forge Babel, etc.).
 * Utilise `ADMIN_PANEL_LOCALE` (comme les e-mails Guardian), sinon locale par défaut du site.
 */
export function internalOpsMessageLocale(): string {
  const raw = process.env.ADMIN_PANEL_LOCALE?.trim() ?? '';
  const cleaned = raw.replace(/^\/+|\/+$/g, '');
  return normalizeAppLocale(cleaned || undefined);
}
