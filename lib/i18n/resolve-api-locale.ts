import { cookies } from 'next/headers';
import { negotiateSiteLocale } from '@/lib/i18n/negotiate-site-locale';
import { normalizeAppLocale } from '@/lib/i18n/normalize-app-locale';

/**
 * Locale pour les réponses JSON des routes API : query `locale` > profil > cookie NEXT_LOCALE > Accept-Language > fr.
 */
export async function resolveApiLocale(
  request: Request,
  profileLanguage?: string | null
): Promise<string> {
  const q = new URL(request.url).searchParams.get('locale')?.toLowerCase().trim();
  if (q) return normalizeAppLocale(q);
  if (profileLanguage) return normalizeAppLocale(profileLanguage);
  const c = (await cookies()).get('NEXT_LOCALE')?.value;
  if (c) return normalizeAppLocale(c);
  const neg = negotiateSiteLocale(request.headers.get('accept-language'));
  if (neg) return neg;
  return normalizeAppLocale('fr');
}
