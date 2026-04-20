import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

/** Lit la locale préférée du profil (colonne `locale`, puis legacy `language` / `preferred_language`). */
export function profileLocaleFromDatabase(row: {
  locale?: string | null;
  language?: string | null;
  preferred_language?: string | null;
} | null | undefined): string {
  const raw = row?.locale ?? row?.language ?? row?.preferred_language;
  return normalizeAppLocale(raw);
}
