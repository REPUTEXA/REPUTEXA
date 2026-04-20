import { normalizeEmailLocale } from '@/lib/emails/auth-email-i18n';

/**
 * Locale pour e-mails transactionnels : alignée sur `profiles.language` (Supabase) quand disponible.
 */
export function resolveEmailLocaleFromProfile(profileLanguage: string | null | undefined): string {
  return normalizeEmailLocale(profileLanguage ?? 'fr');
}
