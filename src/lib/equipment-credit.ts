import { getEmpireSettings } from './empire-settings';

/**
 * Crédit équipement : montants pilotés par `targets/settings.json` (`equipment_credit`).
 * Mensualité type = prix du kit × taux de remboursement (ex. 450 × 0,15 = 67,50 €/mois).
 */
export function getEquipmentCreditSettings() {
  return getEmpireSettings().equipment_credit;
}

export function getEquipmentStarterKitPriceEur(): number {
  return getEquipmentCreditSettings().starter_kit_price;
}

export function getEquipmentRepaymentRate(): number {
  return getEquipmentCreditSettings().repayment_rate;
}

/** Mensualité indicatif (kit × taux). */
export function getEquipmentMonthlyPaymentEstimateEur(): number {
  const { starter_kit_price, repayment_rate } = getEquipmentCreditSettings();
  return Math.round(starter_kit_price * repayment_rate * 100) / 100;
}
