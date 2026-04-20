import { routing } from '@/i18n/routing';

/** Aligned with `i18n/routing` order (English pivot first). */
export const UI_LANGUAGE_OPTIONS: {
  code: (typeof routing.locales)[number];
  label: string;
  flag: string;
  region: string;
}[] = [
  { code: 'en', label: 'English', flag: '🇺🇸', region: 'United States' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', region: 'France' },
  { code: 'es', label: 'Español', flag: '🇪🇸', region: 'España' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', region: 'Deutschland' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹', region: 'Italia' },
];
