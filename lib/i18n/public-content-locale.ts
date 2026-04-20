/** Contenu marketing / pages publiques : FR pour `fr`, anglais pour toutes les autres locales. */
export type PublicContentLang = 'fr' | 'en';

export function publicContentLang(locale: string): PublicContentLang {
  return locale === 'fr' ? 'fr' : 'en';
}
