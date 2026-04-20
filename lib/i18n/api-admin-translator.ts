import { createServerTranslator } from '@/lib/i18n/server-api-translator';

/** Messages API back-office (locale site par défaut). */
export function apiAdminT() {
  return createServerTranslator('ApiAdmin');
}
