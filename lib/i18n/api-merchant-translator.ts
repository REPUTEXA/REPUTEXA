import { createServerTranslator } from '@/lib/i18n/server-api-translator';
import { profileLocaleFromDatabase } from '@/lib/i18n/profile-locale';

export function apiMerchantT(locale?: string | null) {
  return createServerTranslator('ApiMerchant', locale);
}

export function merchantLocaleFromProfileRow(row: {
  locale?: string | null;
  language?: string | null;
  preferred_language?: string | null;
} | null | undefined): string {
  return profileLocaleFromDatabase(row);
}
