import de from 'react-phone-number-input/locale/de.json';
import en from 'react-phone-number-input/locale/en.json';
import es from 'react-phone-number-input/locale/es.json';
import fr from 'react-phone-number-input/locale/fr.json';
import it from 'react-phone-number-input/locale/it.json';
import ja from 'react-phone-number-input/locale/ja.json';
import pt from 'react-phone-number-input/locale/pt.json';
import zh from 'react-phone-number-input/locale/zh.json';

/** Libellés pays + entrée « International » (clé ZZ) pour react-phone-number-input */
const PHONE_LABELS_BY_UI_LOCALE = {
  en,
  fr,
  de,
  es,
  it,
  pt,
  ja,
  zh,
} as const;

export type PhoneInputLabelsJson = typeof en;

export function getPhoneInputLabelsForLocale(siteLocale: string): PhoneInputLabelsJson {
  const key = siteLocale.toLowerCase() as keyof typeof PHONE_LABELS_BY_UI_LOCALE;
  return PHONE_LABELS_BY_UI_LOCALE[key] ?? en;
}
