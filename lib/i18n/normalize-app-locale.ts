import { routing } from '@/i18n/routing';

const VALID = new Set<string>(routing.locales);

/** Langue d’URL / PDF : retombe sur la locale par défaut si valeur inconnue. */
export function normalizeAppLocale(raw: string | null | undefined): string {
  const n = (raw ?? '').toLowerCase().trim();
  return VALID.has(n) ? n : routing.defaultLocale;
}
