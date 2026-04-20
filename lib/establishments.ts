/**
 * Tarification multi-établissements — montants et paliers depuis `targets/settings.json`.
 */

import type { PlanSlug } from '@/lib/feature-gate';
import {
  getAnnualBillingMultiplier,
  getPlanBasePricesEur,
  getVolumeDiscountPercentForSeatIndex,
} from '@/src/lib/empire-settings';

const eurPlans = getPlanBasePricesEur();

export const PLAN_PRICES: Record<PlanSlug, number> = {
  free: 0,
  vision: eurPlans.vision,
  pulse: eurPlans.pulse,
  zenith: eurPlans.zenith,
};

/**
 * Retourne le pourcentage de remise pour l’établissement à l’index donné (0-based).
 */
export function getDiscountForIndex(index: number): number {
  return getVolumeDiscountPercentForSeatIndex(index);
}

/**
 * Calcule le prix mensuel après remise pour l’établissement à l’index donné.
 */
export function getPriceAfterDiscount(basePrice: number, index: number): number {
  const discount = getDiscountForIndex(index);
  return Math.round(basePrice * (1 - discount / 100));
}

/**
 * Calcule le total mensuel à partir d'un prix de base (pour multi-devises).
 */
export function getTotalMonthlyFromBasePrice(basePrice: number, count: number): number {
  if (count <= 0) return 0;
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += getPriceAfterDiscount(basePrice, i);
  }
  return total;
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

/** Total annuel (mensuel × 12 × multiplicateur annuel). Paliers dégressifs puis remise annuelle (config). */
export function getTotalAnnualPrice(planSlug: PlanSlug, count: number): number {
  const monthly = getTotalMonthlyPrice(planSlug, count);
  return Math.round(monthly * 12 * getAnnualBillingMultiplier());
}

/**
 * Calcule l’économie totale réalisée grâce aux remises, par rapport au prix plein.
 */
/** Calcule l'économie totale à partir d'un prix de base. */
export function getTotalSavingsFromBasePrice(basePrice: number, count: number): number {
  if (count <= 1) return 0;
  const fullPrice = basePrice * count;
  const actualPrice = getTotalMonthlyFromBasePrice(basePrice, count);
  return fullPrice - actualPrice;
}

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

/**
 * Montant à payer aujourd'hui pour une expansion de currentCount à newCount établissements (prorata du surplus mensuel).
 */
export function getProratedExpansionAmount(
  planSlug: PlanSlug,
  currentCount: number,
  newCount: number,
  date = new Date()
): number {
  if (newCount <= currentCount) return 0;
  const currentMonthly = getTotalMonthlyPrice(planSlug, currentCount);
  const newMonthly = getTotalMonthlyPrice(planSlug, newCount);
  const additionalMonthly = newMonthly - currentMonthly;
  return getProratedAmount(additionalMonthly, date);
}

/**
 * Prorata expansion en mode annuel : prorata du surplus annuel sur la période restante.
 * Simplification : même formule que mensuel (prorata du surplus mensuel) pour affichage de secours ; Stripe gère le vrai prorata.
 */
export function getProratedExpansionAmountAnnual(
  planSlug: PlanSlug,
  currentCount: number,
  newCount: number,
  date = new Date()
): number {
  if (newCount <= currentCount) return 0;
  const currentAnnual = getTotalAnnualPrice(planSlug, currentCount);
  const newAnnual = getTotalAnnualPrice(planSlug, newCount);
  const additionalAnnual = newAnnual - currentAnnual;
  const daysInYear = 365;
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (24 * 60 * 60 * 1000)
  );
  const daysRemaining = Math.max(1, daysInYear - dayOfYear);
  return Math.round((additionalAnnual * daysRemaining) / daysInYear * 100) / 100;
}
