import { SITE_LOCALE_CODES, type SiteLocaleCode } from '@/lib/i18n/site-locales-catalog';

/**
 * Choisit la meilleure locale supportée à partir du header Accept-Language (qualité q triée).
 */
export function negotiateSiteLocale(acceptLanguage: string | null): SiteLocaleCode | null {
  if (!acceptLanguage?.trim()) return null;
  const supported = new Set<string>(SITE_LOCALE_CODES);

  const parts = acceptLanguage.split(',').map((chunk) => {
    const [rawTag, ...rest] = chunk.trim().split(';');
    const tag = rawTag.trim().toLowerCase();
    const lang = tag.split('-')[0];
    let q = 1;
    for (const r of rest) {
      const m = /^\s*q\s*=\s*([\d.]+)/i.exec(r);
      if (m) {
        const n = parseFloat(m[1]);
        if (!Number.isNaN(n)) q = n;
      }
    }
    return { tag, lang, q };
  });

  parts.sort((a, b) => b.q - a.q);
  for (const p of parts) {
    if (p.tag === 'en-gb' && supported.has('en-gb')) return 'en-gb';
    if (supported.has(p.lang)) return p.lang as SiteLocaleCode;
  }
  return null;
}
