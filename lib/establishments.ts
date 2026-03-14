/**
 * Tarification multi-établissements REPUTEXA
 * Prix mensuels base (VISION 59€, PULSE 98€, ZENITH 179€)
 * Remise dégressive : 1er 0%, 2e -20%, 3e -30%, 4e -40%, 5e+ -50%
 */

import type { PlanSlug } from '@/lib/feature-gate';

export const PLAN_PRICES: Record<PlanSlug, number> = {
  vision: 59,
  pulse: 98,
  zenith: 179,
};

/** Pourcentage de remise selon l’index (0-based) : 1er=0%, 2e=20%, 3e=30%, 4e=40%, 5e+=50% */
const DISCOUNT_BY_INDEX: Record<number, number> = {
  0: 0,
  1: 20,
  2: 30,
  3: 40,
};

const MAX_DISCOUNT = 50;
const DISCOUNT_FOR_5_PLUS = 50;

/**
 * Retourne le pourcentage de remise pour l’établissement à l’index donné (0-based).
 */
export function getDiscountForIndex(index: number): number {
  if (index < 4) return DISCOUNT_BY_INDEX[index] ?? 0;
  return Math.min(MAX_DISCOUNT, DISCOUNT_FOR_5_PLUS);
}

/**
 * Calcule le prix mensuel après remise pour l’établissement à l’index donné.
 */
export function getPriceAfterDiscount(basePrice: number, index: number): number {
  const discount = getDiscountForIndex(index);
  return Math.round(basePrice * (1 - discount / 100));
}

/**
 * Calcule le total mensuel pour N établissements sur un plan donné.
 */
export function getTotalMonthlyPrice(planSlug: PlanSlug, count: number): number {
  if (count <= 0) return 0;
  const basePrice = PLAN_PRICES[planSlug];
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += getPriceAfterDiscount(basePrice, i);
  }
  return total;
}

/**
 * Calcule l’économie totale réalisée grâce aux remises, par rapport au prix plein.
 */
export function getTotalSavings(planSlug: PlanSlug, count: number): number {
  if (count <= 1) return 0;
  const basePrice = PLAN_PRICES[planSlug];
  const fullPrice = basePrice * count;
  const actualPrice = getTotalMonthlyPrice(planSlug, count);
  return fullPrice - actualPrice;
}

/**
 * Calcule le montant proratisé pour le restant du mois.
 * Ex: 143€/mois, jour 15 sur 30 → ~71.50€
 */
export function getProratedAmount(monthlyPrice: number, date = new Date()): number {
  const day = date.getDate();
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - day + 1);
  return Math.round((monthlyPrice * daysRemaining) / daysInMonth * 100) / 100;
}
