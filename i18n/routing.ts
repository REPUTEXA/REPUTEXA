import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['fr', 'en', 'es', 'de', 'it'],
  defaultLocale: 'fr',
  localePrefix: 'always',
  localeDetection: true,
});
