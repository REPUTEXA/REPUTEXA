/**
 * Configuration tarification REPUTEXA — centralisée.
 * Plans utilisés partout dans l'app : VISION, PULSE, ZENITH (slugs : vision, pulse, zenith).
 * Alignée sur les Graduated Tiers Stripe : 1er 0%, 2e -20%, 3e -30%, 4e -40%, 5e+ -50%.
 * Annuel : -20% sur le total. Affichage annuel côté front : prix / 12 en gros + "Facturé annuellement (total)" en petit.
 *
 * Cohérence .env : les IDs de prix Stripe doivent correspondre exactement à ceux configurés
 * dans le Dashboard Stripe (Products > Prix avec Graduated Tiers). Clés attendues :
 *
 *   STRIPE_PRICE_ID_VISION        (Vision mensuel)
 *   STRIPE_PRICE_ID_VISION_ANNUAL (Vision annuel -20%)
 *   STRIPE_PRICE_ID_PULSE        (Pulse mensuel)
 *   STRIPE_PRICE_ID_PULSE_ANNUAL (Pulse annuel -20%)
 *   STRIPE_PRICE_ID_ZENITH       (Zenith mensuel)
 *   STRIPE_PRICE_ID_ZENITH_ANNUAL (Zenith annuel -20%)
 */

export type PlanSlug = 'vision' | 'pulse' | 'zenith';

/** Variables d'environnement des Price IDs Stripe (échelonnés / Graduated Tiers) — doit correspondre au .env */
export const PRICE_ID_ENV_KEYS = {
  vision: { monthly: 'STRIPE_PRICE_ID_VISION', annual: 'STRIPE_PRICE_ID_VISION_ANNUAL' },
  pulse: { monthly: 'STRIPE_PRICE_ID_PULSE', annual: 'STRIPE_PRICE_ID_PULSE_ANNUAL' },
  zenith: { monthly: 'STRIPE_PRICE_ID_ZENITH', annual: 'STRIPE_PRICE_ID_ZENITH_ANNUAL' },
} as const;

/** Prix de base mensuels (EUR) — Vision 59€, Pulse 97€, Zenith 179€ */
export const PLAN_BASE_PRICES_EUR: Record<PlanSlug, number> = {
  vision: 59,
  pulse: 97,
  zenith: 179,
};

/** Prix de base mensuels (USD) pour locale EN */
export const PLAN_BASE_PRICES_USD: Record<PlanSlug, number> = {
  vision: 65,
  pulse: 107,
  zenith: 199,
};

/** Paliers Stripe (Graduated Tiers) : 1er 0%, 2e -20%, 3e -30%, 4e -40%, 5e+ -50%. Aligné à 100% avec le Dashboard Stripe. */
const DISCOUNT_BY_INDEX: Record<number, number> = {
  0: 0,
  1: 20,
  2: 30,
  3: 40,
};

const MAX_DISCOUNT = 50;

function getDiscountForIndex(index: number): number {
  if (index < 4) return DISCOUNT_BY_INDEX[index] ?? 0;
  return MAX_DISCOUNT;
}

function getUnitPriceAfterDiscount(basePrice: number, index: number): number {
  const discount = getDiscountForIndex(index);
  return Math.round(basePrice * (1 - discount / 100));
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
    return Math.round(totalMonthly * 12 * 0.8); // -20% annuel
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
  const annualTotal = Math.round(monthlyTotal * 12 * 0.8);
  const fullAnnual = monthlyTotal * 12;
  return fullAnnual - annualTotal;
}

/**
 * Retourne le Price ID Stripe (depuis env) pour le plan et l'intervalle.
 */
export function getStripePriceId(planSlug: PlanSlug, isAnnual: boolean): string | null {
  const keys = PRICE_ID_ENV_KEYS[planSlug];
  const envKey = isAnnual ? keys.annual : keys.monthly;
  const priceId = process.env[envKey];
  if (priceId) return priceId;
  return process.env[keys.monthly] ?? null;
}
