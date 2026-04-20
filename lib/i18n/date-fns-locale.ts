import type { Locale } from 'date-fns';
import { de, enGB, enUS, es, fr, it, ja, ptBR, zhCN } from 'date-fns/locale';

/** Locale date-fns alignée sur les codes URL du site (fr, en, de, …). */
export function dateFnsLocaleForApp(code: string): Locale {
  switch (code) {
    case 'fr':
      return fr;
    case 'en-gb':
      return enGB;
    case 'en':
      return enUS;
    case 'de':
      return de;
    case 'es':
      return es;
    case 'it':
      return it;
    case 'pt':
      return ptBR;
    case 'ja':
      return ja;
    case 'zh':
      return zhCN;
    default:
      return fr;
  }
}
