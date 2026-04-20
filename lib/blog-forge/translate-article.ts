import OpenAI from 'openai';
import type { Article } from '@/lib/i18n/blog-articles/types';
import { SITE_LOCALE_CODES, type SiteLocaleCode } from '@/lib/i18n/site-locales-catalog';

const LOCALE_LABEL: Record<SiteLocaleCode, string> = {
  fr: 'français',
  en: 'English (US)',
  'en-gb': 'English (UK)',
  es: 'español',
  de: 'Deutsch',
  it: 'italiano',
  pt: 'português',
  ja: '日本語',
  zh: '简体中文',
};

export async function translateArticle(
  source: Article,
  targetLocale: SiteLocaleCode
): Promise<Article> {
  if (targetLocale === 'fr') return source;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.35,
    max_tokens: 8000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Tu traduis et adaptes un article JSON d'e-réputation pour la locale ${LOCALE_LABEL[targetLocale]}.
Règles : conserve la structure JSON exacte (mêmes clés, mêmes tableaux). Adapte culturellement le ton (politesse JP si japonais, etc.).
Ne modifie pas le champ "slug". Les champs "author" peuvent rester "REPUTEXA Intelligence" ou équivalent naturel dans la langue cible.
Pour "category", garde le libellé FR original (requis pour le moteur du site).`,
      },
      {
        role: 'user',
        content: `Traduis vers ${LOCALE_LABEL[targetLocale]} :\n${JSON.stringify(source)}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as Article;
  parsed.slug = source.slug;
  return parsed;
}

export async function translateArticleToAllLocales(fr: Article): Promise<Partial<Record<SiteLocaleCode, Article>>> {
  const out: Partial<Record<SiteLocaleCode, Article>> = {};
  for (const loc of SITE_LOCALE_CODES) {
    if (loc === 'fr') continue;
    out[loc] = await translateArticle(fr, loc);
  }
  return out;
}
