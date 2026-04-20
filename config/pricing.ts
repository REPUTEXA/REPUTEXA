/**
 * Configuration tarification — centralisée dans `targets/settings.json` (`billing.plans`, paliers, remise annuelle).
 * Plans utilisés partout dans l'app : VISION, PULSE, ZENITH (slugs : vision, pulse, zenith).
 * Alignée sur les Graduated Tiers Stripe : 1er 0%, 2e -20%, 3e -30%, 4e -40%, 5e+ -50%.
 * Annuel : remise `annual_discount_rate` sur le total. Affichage annuel côté front : prix / 12 en gros + "Facturé annuellement (total)" en petit.
 *
 * Devises catalogue : `/en` → USD, `/en-gb` → GBP, `/ja` → JPY, `/zh` → CNY, locales `*-ca` → CAD, `*-au` → AUD, Europe (fr/de/es/it/pt) → EUR ; cookie `user-currency` prime pour l’UI et Stripe (incl. CHF). Sinon, devise inconnue → EUR.
 *
 * Price IDs : priorité aux variables `.env`, puis `billing.plans.*.prices.*.stripePriceId` si ID Stripe réel
 * (les placeholders `price_*_*_ID` sont ignorés jusqu’à remplacement dans le Dashboard Stripe).
 *
 * Si une devise manque, repli sur les Price IDs EUR (log serveur).
 */

import {
  getAnnualBillingMultiplier,
  getPlanBasePricesAud,
  getPlanBasePricesCad,
  getPlanBasePricesChf,
  getPlanBasePricesCny,
  getPlanBasePricesEur,
  getPlanBasePricesGbp,
  getPlanBasePricesJpy,
  getPlanBasePricesUsd,
  getStripePriceIdFromBillingSettings,
  getVolumeDiscountPercentForSeatIndex,
} from '@/src/lib/empire-settings';

export type PlanSlug = 'vision' | 'pulse' | 'zenith';

export type BillingCurrency = 'eur' | 'usd' | 'gbp' | 'jpy' | 'cny' | 'chf' | 'cad' | 'aud';

const STRIPE_PRICE_KEYS = {
  eur: {
    vision: { monthly: 'STRIPE_PRICE_ID_VISION', annual: 'STRIPE_PRICE_ID_VISION_ANNUAL' },
    pulse: { monthly: 'STRIPE_PRICE_ID_PULSE', annual: 'STRIPE_PRICE_ID_PULSE_ANNUAL' },
    zenith: { monthly: 'STRIPE_PRICE_ID_ZENITH', annual: 'STRIPE_PRICE_ID_ZENITH_ANNUAL' },
  },
  usd: {
    vision: { monthly: 'STRIPE_PRICE_ID_VISION_USD', annual: 'STRIPE_PRICE_ID_VISION_ANNUAL_USD' },
    pulse: { monthly: 'STRIPE_PRICE_ID_PULSE_USD', annual: 'STRIPE_PRICE_ID_PULSE_ANNUAL_USD' },
    zenith: { monthly: 'STRIPE_PRICE_ID_ZENITH_USD', annual: 'STRIPE_PRICE_ID_ZENITH_ANNUAL_USD' },
  },
  gbp: {
    vision: { monthly: 'STRIPE_PRICE_ID_VISION_GBP', annual: 'STRIPE_PRICE_ID_VISION_ANNUAL_GBP' },
    pulse: { monthly: 'STRIPE_PRICE_ID_PULSE_GBP', annual: 'STRIPE_PRICE_ID_PULSE_ANNUAL_GBP' },
    zenith: { monthly: 'STRIPE_PRICE_ID_ZENITH_GBP', annual: 'STRIPE_PRICE_ID_ZENITH_ANNUAL_GBP' },
  },
  jpy: {
    vision: { monthly: 'STRIPE_PRICE_ID_VISION_JPY', annual: 'STRIPE_PRICE_ID_VISION_ANNUAL_JPY' },
    pulse: { monthly: 'STRIPE_PRICE_ID_PULSE_JPY', annual: 'STRIPE_PRICE_ID_PULSE_ANNUAL_JPY' },
    zenith: { monthly: 'STRIPE_PRICE_ID_ZENITH_JPY', annual: 'STRIPE_PRICE_ID_ZENITH_ANNUAL_JPY' },
  },
  cny: {
    vision: { monthly: 'STRIPE_PRICE_ID_VISION_CNY', annual: 'STRIPE_PRICE_ID_VISION_ANNUAL_CNY' },
    pulse: { monthly: 'STRIPE_PRICE_ID_PULSE_CNY', annual: 'STRIPE_PRICE_ID_PULSE_ANNUAL_CNY' },
    zenith: { monthly: 'STRIPE_PRICE_ID_ZENITH_CNY', annual: 'STRIPE_PRICE_ID_ZENITH_ANNUAL_CNY' },
  },
  chf: {
    vision: { monthly: 'STRIPE_PRICE_ID_VISION_CHF', annual: 'STRIPE_PRICE_ID_VISION_ANNUAL_CHF' },
    pulse: { monthly: 'STRIPE_PRICE_ID_PULSE_CHF', annual: 'STRIPE_PRICE_ID_PULSE_ANNUAL_CHF' },
    zenith: { monthly: 'STRIPE_PRICE_ID_ZENITH_CHF', annual: 'STRIPE_PRICE_ID_ZENITH_ANNUAL_CHF' },
  },
  cad: {
    vision: { monthly: 'STRIPE_PRICE_ID_VISION_CAD', annual: 'STRIPE_PRICE_ID_VISION_ANNUAL_CAD' },
    pulse: { monthly: 'STRIPE_PRICE_ID_PULSE_CAD', annual: 'STRIPE_PRICE_ID_PULSE_ANNUAL_CAD' },
    zenith: { monthly: 'STRIPE_PRICE_ID_ZENITH_CAD', annual: 'STRIPE_PRICE_ID_ZENITH_ANNUAL_CAD' },
  },
  aud: {
    vision: { monthly: 'STRIPE_PRICE_ID_VISION_AUD', annual: 'STRIPE_PRICE_ID_VISION_ANNUAL_AUD' },
    pulse: { monthly: 'STRIPE_PRICE_ID_PULSE_AUD', annual: 'STRIPE_PRICE_ID_PULSE_ANNUAL_AUD' },
    zenith: { monthly: 'STRIPE_PRICE_ID_ZENITH_AUD', annual: 'STRIPE_PRICE_ID_ZENITH_ANNUAL_AUD' },
  },
} as const;

const SETTINGS_CURRENCY: Record<
  BillingCurrency,
  'EUR' | 'USD' | 'GBP' | 'JPY' | 'CNY' | 'CHF' | 'CAD' | 'AUD'
> = {
  eur: 'EUR',
  usd: 'USD',
  gbp: 'GBP',
  jpy: 'JPY',
  cny: 'CNY',
  chf: 'CHF',
  cad: 'CAD',
  aud: 'AUD',
};

/** Code ISO 4217 pour Intl / texte (même grille que le catalogue Stripe). */
export function billingCurrencyToIso4217(c: BillingCurrency): string {
  return SETTINGS_CURRENCY[c];
}

/** Alias historique : Price IDs EUR (Stripe catalogue principal). */
export const PRICE_ID_ENV_KEYS = STRIPE_PRICE_KEYS.eur;

const eur = getPlanBasePricesEur();
const usd = getPlanBasePricesUsd();
const gbp = getPlanBasePricesGbp();
const jpy = getPlanBasePricesJpy();
const cny = getPlanBasePricesCny();
const chf = getPlanBasePricesChf();
const cad = getPlanBasePricesCad();
const aud = getPlanBasePricesAud();

/** Prix de base mensuels (EUR) */
export const PLAN_BASE_PRICES_EUR: Record<PlanSlug, number> = {
  vision: eur.vision,
  pulse: eur.pulse,
  zenith: eur.zenith,
};

/** Prix de base mensuels (USD) — locale `en` (US English) */
export const PLAN_BASE_PRICES_USD: Record<PlanSlug, number> = {
  vision: usd.vision,
  pulse: usd.pulse,
  zenith: usd.zenith,
};

/** Prix de base mensuels (GBP) — locale `en-gb` */
export const PLAN_BASE_PRICES_GBP: Record<PlanSlug, number> = {
  vision: gbp.vision,
  pulse: gbp.pulse,
  zenith: gbp.zenith,
};

/** Prix de base mensuels (JPY) — locale `ja` (entiers, sans centimes) */
export const PLAN_BASE_PRICES_JPY: Record<PlanSlug, number> = {
  vision: jpy.vision,
  pulse: jpy.pulse,
  zenith: jpy.zenith,
};

/** Prix de base mensuels (CNY) — locale `zh` */
export const PLAN_BASE_PRICES_CNY: Record<PlanSlug, number> = {
  vision: cny.vision,
  pulse: cny.pulse,
  zenith: cny.zenith,
};

/** Prix de base mensuels (CHF) — sélecteur devise / marché CH */
export const PLAN_BASE_PRICES_CHF: Record<PlanSlug, number> = {
  vision: chf.vision,
  pulse: chf.pulse,
  zenith: chf.zenith,
};

/** Prix de base mensuels (CAD) — locales `fr-ca` / `en-ca`, sélecteur devise */
export const PLAN_BASE_PRICES_CAD: Record<PlanSlug, number> = {
  vision: cad.vision,
  pulse: cad.pulse,
  zenith: cad.zenith,
};

/** Prix de base mensuels (AUD) — locale `en-au`, sélecteur devise */
export const PLAN_BASE_PRICES_AUD: Record<PlanSlug, number> = {
  vision: aud.vision,
  pulse: aud.pulse,
  zenith: aud.zenith,
};

/**
 * Devise Stripe catalogue : `/en` → USD, `/en-gb` → GBP, `/ja` → JPY, `/zh` → CNY,
 * `fr-ca` / `en-ca` → CAD, `en-au` → AUD, autres Europe → EUR.
 */
export function localeToBillingCurrency(locale: string | null | undefined): BillingCurrency {
  const raw = (locale ?? '').toLowerCase().trim().replace(/_/g, '-');
  const parts = raw.split('-').filter(Boolean);
  const region = parts.length >= 2 ? parts[parts.length - 1] : '';
  if (region === 'au') return 'aud';
  if (region === 'ca') return 'cad';
  if (raw === 'en') return 'usd';
  if (raw === 'en-gb') return 'gbp';
  if (raw === 'ja') return 'jpy';
  if (raw === 'zh' || raw === 'zh-cn' || raw === 'zh-hans') return 'cny';
  return 'eur';
}

export function getPlanBasePricesForBillingCurrency(currency: BillingCurrency): Record<PlanSlug, number> {
  if (currency === 'usd') return PLAN_BASE_PRICES_USD;
  if (currency === 'gbp') return PLAN_BASE_PRICES_GBP;
  if (currency === 'jpy') return PLAN_BASE_PRICES_JPY;
  if (currency === 'cny') return PLAN_BASE_PRICES_CNY;
  if (currency === 'chf') return PLAN_BASE_PRICES_CHF;
  if (currency === 'cad') return PLAN_BASE_PRICES_CAD;
  if (currency === 'aud') return PLAN_BASE_PRICES_AUD;
  return PLAN_BASE_PRICES_EUR;
}

function getUnitPriceAfterDiscount(basePrice: number, index: number): number {
  const discount = getVolumeDiscountPercentForSeatIndex(index);
  return Math.round(basePrice * (1 - discount / 100));
}

/**
 * Montants mensuels unitaires par siège (1er plein tarif, puis paliers −20 % / −30 % / −40 % / −50 %).
 * Pour l’affichage admin (-stack multi-établissements) — la remise annuelle (−20 % sur le total) est appliquée après coup via `monthlyMrrEurWithVolumeDiscounts`.
 */
export function degressiveSeatMonthlyPricesEur(basePriceEur: number, seatCount: number): number[] {
  if (seatCount <= 0 || !Number.isFinite(basePriceEur)) return [];
  const out: number[] = [];
  for (let i = 0; i < seatCount; i++) {
    out.push(getUnitPriceAfterDiscount(basePriceEur, i));
  }
  return out;
}

/**
 * Calcule le prix total (reproduit exactement la logique des paliers Stripe).
 * @param basePrice - Prix mensuel de base (1er établissement)
 * @param quantity - Nombre d'établissements
 * @param isAnnual - Si true, applique -20% annuel
 * @returns Montant affiché : mensuel (par mois) ou annuel (par an) selon isAnnual
 */
export function calculatePrice(
  basePrice: number,
  quantity: number,
  isAnnual: boolean
): number {
  if (quantity <= 0) return 0;
  let totalMonthly = 0;
  for (let i = 0; i < quantity; i++) {
    totalMonthly += getUnitPriceAfterDiscount(basePrice, i);
  }
  if (isAnnual) {
    return Math.round(totalMonthly * 12 * getAnnualBillingMultiplier());
  }
  return totalMonthly;
}

/**
 * Prix mensuel total pour quantity établissements (sans remise annuelle).
 */
export function calculateMonthlyTotal(basePrice: number, quantity: number): number {
  if (quantity <= 0) return 0;
  let total = 0;
  for (let i = 0; i < quantity; i++) {
    total += getUnitPriceAfterDiscount(basePrice, i);
  }
  return total;
}

/**
 * Équivalent MRR mensuel (EUR) pour `quantity` sièges sur un plan, paliers dégressifs inclus.
 * Facturation annuelle Stripe : équivalent mensuel après -20 % sur le total annuel (= pile mensuel × 0,8).
 */
export function monthlyMrrEurWithVolumeDiscounts(
  planSlug: PlanSlug,
  quantity: number,
  isAnnual: boolean
): number {
  if (quantity <= 0) return 0;
  const base = PLAN_BASE_PRICES_EUR[planSlug];
  const monthlyStack = calculateMonthlyTotal(base, quantity);
  const v = isAnnual ? monthlyStack * getAnnualBillingMultiplier() : monthlyStack;
  return Number(v.toFixed(2));
}

/** Ligne minimaliste pour regrouper plusieurs abonnements Stripe d’un même payeur (admin investisseur). */
export type SubscriberPlanBucketRow = {
  planSlug: PlanSlug | null;
  billingAnnual: boolean;
  mrrEur: number;
};

/**
 * MRR affiché pour un groupe de plusieurs abonnements : recalcule les paliers REPUTEXA (1er plein tarif,
 * 2e -20 %, 3e -30 %, 4e -40 %, 5e+ -50 %) **par couple (plan, mensuel/annuel)**, comme une seule stack
 * d’établissements. Les lignes sans `planSlug` restent en somme brute Stripe. Un seul abonnement : MRR Stripe inchangé
 * (quantité > 1 déjà reflétée dans Stripe).
 */
export function subscriberGroupMrrEurDegressive(rows: SubscriberPlanBucketRow[]): number {
  if (rows.length === 0) return 0;
  if (rows.length === 1) return Number(rows[0].mrrEur.toFixed(2));

  let total = 0;
  for (const r of rows) {
    if (!r.planSlug) total += r.mrrEur;
  }

  const bucketCounts = new Map<string, number>();
  for (const r of rows) {
    if (!r.planSlug) continue;
    const key = `${r.planSlug}:${r.billingAnnual ? 'a' : 'm'}`;
    bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
  }
  for (const [key, count] of Array.from(bucketCounts.entries())) {
    const sep = key.lastIndexOf(':');
    const slug = key.slice(0, sep) as PlanSlug;
    const cycle = key.slice(sep + 1);
    total += monthlyMrrEurWithVolumeDiscounts(slug, count, cycle === 'a');
  }
  return Number(total.toFixed(2));
}

/**
 * Économie par rapport au prix plein (pour badge "Économisez X€").
 */
export function calculateSavings(basePrice: number, quantity: number): number {
  if (quantity <= 1) return 0;
  const fullPrice = basePrice * quantity;
  const actualPrice = calculateMonthlyTotal(basePrice, quantity);
  return fullPrice - actualPrice;
}

/**
 * Économie annuelle en passant en annuel (pour badge).
 */
export function calculateAnnualSavings(basePrice: number, quantity: number): number {
  const monthlyTotal = calculateMonthlyTotal(basePrice, quantity);
  const annualTotal = Math.round(monthlyTotal * 12 * getAnnualBillingMultiplier());
  const fullAnnual = monthlyTotal * 12;
  return fullAnnual - annualTotal;
}

/**
 * Price ID Stripe pour le plan, l’intervalle et la devise (produits distincts dans le Dashboard Stripe).
 * Priorité : `.env` → `targets/settings.json` (`billing.plans`) pour le mensuel uniquement → repli EUR.
 */
export function getStripePriceId(
  planSlug: PlanSlug,
  isAnnual: boolean,
  currency: BillingCurrency = 'eur'
): string | null {
  const keys = STRIPE_PRICE_KEYS[currency][planSlug];
  const envKey = isAnnual ? keys.annual : keys.monthly;
  let priceId = process.env[envKey];
  if (priceId) return priceId;
  priceId = process.env[keys.monthly];
  if (priceId) return priceId;

  if (!isAnnual) {
    const fromSettings = getStripePriceIdFromBillingSettings(planSlug, SETTINGS_CURRENCY[currency]);
    if (fromSettings) return fromSettings;
  }

  if (currency !== 'eur') {
    console.warn(`[billing] Missing Stripe ${currency} price for ${planSlug}; falling back to EUR`);
    return getStripePriceId(planSlug, isAnnual, 'eur');
  }
  return null;
}

/** Tous les Price IDs .env + settings (mensuel) connus pour un plan — matching abonnement / webhook. */
export function listAllStripePriceIdsForPlan(planSlug: PlanSlug): string[] {
  const currencies: BillingCurrency[] = ['eur', 'usd', 'gbp', 'jpy', 'cny', 'chf', 'cad', 'aud'];
  const ids: string[] = [];
  for (const currency of currencies) {
    for (const annual of [false, true]) {
      const keys = STRIPE_PRICE_KEYS[currency][planSlug];
      const envKey = annual ? keys.annual : keys.monthly;
      let id = process.env[envKey] ?? process.env[keys.monthly];
      if (!id && !annual) {
        id = getStripePriceIdFromBillingSettings(planSlug, SETTINGS_CURRENCY[currency]) ?? undefined;
      }
      if (id) ids.push(id);
    }
  }
  return Array.from(new Set(ids));
}
