import type { SupabaseClient } from '@supabase/supabase-js';
import type { Country } from 'react-phone-number-input';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';
import { defaultPhoneCountryFromMerchantProfile } from '@/lib/phone/merchant-default-country';

/**
 * Langue « compte » pour tout ce qui sort du serveur (PDF, WhatsApp cron, e-mails) :
 * alignée sur `profiles.language`, mise à jour quand l’utilisateur change la langue
 * (sélecteur header → POST /api/user/locale).
 */
export function localeFromProfileRow(language: string | null | undefined): string {
  return normalizeAppLocale(language);
}

export async function getMerchantLocaleForUserId(
  supabase: Pick<SupabaseClient, 'from'>,
  userId: string
): Promise<string> {
  const { data } = await supabase.from('profiles').select('language').eq('id', userId).maybeSingle();
  return localeFromProfileRow((data as { language?: string } | null)?.language);
}

/** Code pays (téléphone) pour parser les saisies nationales : `profiles.country` ou langue du compte. */
export async function getMerchantPhoneDefaultCountry(
  supabase: Pick<SupabaseClient, 'from'>,
  userId: string
): Promise<Country> {
  const { data } = await supabase
    .from('profiles')
    .select('language, country')
    .eq('id', userId)
    .maybeSingle();
  const row = data as { language?: string; country?: string } | null;
  return defaultPhoneCountryFromMerchantProfile({
    language: row?.language,
    country: row?.country,
  });
}
