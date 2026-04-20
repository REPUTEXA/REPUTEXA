/**
 * Affichage des montants catalogue depuis `config/pricing` / `targets/settings.json`.
 * Utilisé par l’injection i18n (`[[PX:…]]`) et par les pages qui formatent hors dictionnaire.
 */

import {
  billingCurrencyToIso4217,
  getPlanBasePricesForBillingCurrency,
  localeToBillingCurrency,
  type PlanSlug,
} from '@/config/pricing';
import { getPlanBasePricesEur } from '@/src/lib/empire-settings';

const LOCALE_INTL: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  'en-gb': 'en-GB',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  ja: 'ja-JP',
  pt: 'pt-PT',
  zh: 'zh-CN',
};

const MONTH_SUFFIX: Record<string, string> = {
  fr: '/mois',
  en: '/month',
  'en-gb': '/month',
  es: '/mes',
  de: '/Monat',
  it: '/mese',
  ja: '/月',
  pt: '/mês',
  zh: '/月',
};

const TOKEN_RE = /\[\[PX:(vision|pulse|zenith)(?::(mo|num))?\]\]/g;

const ZERO_TOKEN_RE = /\[\[PX:zero\]\]/g;

/**
 * Montant nul dans la devise facturation associée à la locale (EUR, USD, GBP, JPY…).
 * Utilisé pour les mentions « 0 aujourd’hui » trial — pas de € codé en dur dans les JSON.
 */
export function formatZeroAmountForLocale(appLocale: string): string {
  const billing = localeToBillingCurrency(appLocale);
  const intl = LOCALE_INTL[appLocale] ?? 'fr-FR';
  const currency = billingCurrencyToIso4217(billing);
  return new Intl.NumberFormat(intl, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(0);
}

export type PlanPriceFormatOptions = {
  monthly?: boolean;
  /** Chiffre seul (catalogue pour la devise de la locale), ex. carte pricing. */
  numericOnly?: boolean;
};

export function formatPlanAmountForLocale(
  appLocale: string,
  plan: PlanSlug,
  opts: PlanPriceFormatOptions = {},
): string {
  const billing = localeToBillingCurrency(appLocale);
  const bases = getPlanBasePricesForBillingCurrency(billing);
  const num = bases[plan];
  if (opts.numericOnly) {
    return String(Math.round(num));
  }
  const intl = LOCALE_INTL[appLocale] ?? 'fr-FR';
  const currency = billingCurrencyToIso4217(billing);

  let s = new Intl.NumberFormat(intl, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);

  if (opts.monthly) {
    s += MONTH_SUFFIX[appLocale] ?? '/month';
  }
  return s;
}

/** Trio catalogue en EUR (affichage data room / investisseurs, toujours €). */
export function formatPlanTrioCatalogEur(): string {
  const e = getPlanBasePricesEur();
  const fmt = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${fmt.format(e.vision)} / ${fmt.format(e.pulse)} / ${fmt.format(e.zenith)}`;
}

export function expandPricingTokensInString(s: string, locale: string): string {
  let out = s.replace(TOKEN_RE, (_, slug: PlanSlug, variant: string | undefined) => {
    if (variant === 'mo') {
      return formatPlanAmountForLocale(locale, slug, { monthly: true });
    }
    if (variant === 'num') {
      return formatPlanAmountForLocale(locale, slug, { numericOnly: true });
    }
    return formatPlanAmountForLocale(locale, slug);
  });
  out = out.replace(ZERO_TOKEN_RE, () => formatZeroAmountForLocale(locale));
  return out;
}
