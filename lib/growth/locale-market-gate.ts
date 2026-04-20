import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { routing } from '@/i18n/routing';
import { localeToGateCountryCode } from '@/lib/i18n/site-locales-catalog';

/**
 * Bloque /de, /pt, etc. tant que le marché n’a pas « Site locale ON » dans l’admin.
 * Ne remplace pas les fichiers messages/*.json : ils doivent exister pour la locale.
 *
 * En développement : aucune vérif DB (évite 404 sur /es, /de… si la War Room n’a pas le flag).
 * Espagnol et italien : toujours servis en prod (messages tenus comme le FR, pas d’interrupteur pays).
 */
export async function assertLocalePublishedOrNotFound(locale: string): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    return;
  }
  if (locale === routing.defaultLocale || locale === 'en') return;
  if (locale === 'it' || locale === 'es') return;
  const countryCode = localeToGateCountryCode(locale);
  if (!countryCode) return;

  try {
    const row = await prisma.growthCountryConfig.findUnique({
      where: { countryCode },
      select: { publicSiteLocaleEnabled: true },
    });
    if (row && !row.publicSiteLocaleEnabled) notFound();
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[locale-market-gate] skip (DB / migration ?)', e);
    }
  }
}
