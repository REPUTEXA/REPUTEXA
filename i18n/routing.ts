import { defineRouting } from 'next-intl/routing';
import { SITE_LOCALE_CODES } from '@/lib/i18n/site-locales-catalog';

export const routing = defineRouting({
  locales: [...SITE_LOCALE_CODES],
  defaultLocale: 'fr',
  localePrefix: 'always',
  localeDetection: true,
});
