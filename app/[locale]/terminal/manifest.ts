import type { MetadataRoute } from 'next';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';

/** PWA : ouverture directe du terminal plein écran (favori tablette). Texte depuis `TerminalPwa` (locale par défaut pour le manifest statique). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'TerminalPwa' });
  return {
    name: t('manifestName'),
    short_name: t('manifestShortName'),
    description: t('manifestDescription'),
    start_url: `/${locale}/terminal`,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0f172a',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
