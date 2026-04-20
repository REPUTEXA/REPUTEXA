import { getRequestConfig } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
import { mergeMessagesDeep } from '@/lib/i18n/merge-messages-deep';
import { injectBrandIntoMessages } from '@/lib/i18n/inject-brand-into-messages';
import { injectPricingIntoMessages } from '@/lib/i18n/inject-pricing-into-messages';
import { getBrandName } from '@/src/lib/empire-settings';
import { routing } from './routing';
import legalEnCgu from '../messages/legal-en/cgu.json';
import legalEnConfidentialite from '../messages/legal-en/confidentialite.json';
import legalEnMentions from '../messages/legal-en/mentions-legales.json';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    requested && routing.locales.includes(requested as (typeof routing.locales)[number])
      ? requested
      : routing.defaultLocale;

  /**
   * Une seule locale par requête : `import()` dynamique par fichier JSON (chunks séparés au build).
   * Pas de chargement des 8 dictionnaires : seulement la locale active, plus la locale par défaut (FR)
   * lorsqu’il faut fusionner les clés manquantes via `mergeMessagesDeep`.
   *
   * Le fichier `messages/{locale}.json` est monolithique (tout le produit) : pour réduire le coût
   * par route, option future : découper en modules (ex. `messages/fr/dashboard.json`) et
   * `Promise.all` + merge des namespaces nécessaires dans chaque layout (`Common` + `Dashboard` seulement).
   * Le middleware ne charge pas les messages (voir `middleware.ts`).
   */
  let messages: Record<string, unknown>;
  if (locale === routing.defaultLocale) {
    messages = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;
  } else {
    const defaultMessages = (await import(`../messages/${routing.defaultLocale}.json`)).default as Record<
      string,
      unknown
    >;

    if (locale === 'en-gb') {
      /**
       * `en-gb.json` est une variante UK (devises, libellés) : il ne reprend pas toute l’arborescence de `fr`.
       * Un simple `merge(fr, en-gb)` faisait retomber les clés manquantes sur le français sur la landing et ailleurs.
       * On applique d’abord `en` comme couche anglaise complète, puis `en-gb` par-dessus.
       */
      const enMessages = (await import(`../messages/en.json`)).default as Record<string, unknown>;
      const enGbMessages = (await import(`../messages/en-gb.json`)).default as Record<string, unknown>;
      messages = mergeMessagesDeep(mergeMessagesDeep(defaultMessages, enMessages), enGbMessages);
    } else {
      const localeMessages = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;
      /**
       * FR d’abord, locale par-dessus : toute clé absente ou chaîne vide dans la locale retombe sur le français
       * (voir `mergeMessagesDeep`).
       */
      messages = mergeMessagesDeep(defaultMessages, localeMessages);
    }
  }

  if (locale === 'en' || locale === 'en-gb') {
    messages = mergeMessagesDeep(messages, {
      Legal: {
        mentionsLegales: legalEnMentions,
        confidentialite: legalEnConfidentialite,
        cgu: legalEnCgu,
      },
    });
  }

  messages = injectBrandIntoMessages(messages, getBrandName()) as Record<string, unknown>;
  messages = injectPricingIntoMessages(messages, locale) as Record<string, unknown>;

  return {
    locale,
    messages: messages as AbstractIntlMessages,
  };
});
