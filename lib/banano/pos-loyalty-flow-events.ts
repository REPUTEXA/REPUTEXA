/**
 * Valeurs `event_type` actuellement autorisées sur `banano_loyalty_events` (contrainte SQL).
 * Les API « flux caisse » marchand comptent et exportent toutes les lignes fidélité du marchand,
 * pas seulement un sous-ensemble.
 */
export const BANANO_LOYALTY_EVENT_TYPES_ALL = [
  'earn_points',
  'redeem_points',
  'earn_stamps',
  'redeem_stamps',
  'encaisser_reward',
  'member_created',
  'voucher_issued',
  'voucher_redeemed',
  'staff_allowance_issued',
  'staff_allowance_debit',
  'staff_allowance_merchant_adjust',
] as const;

export type BananoLoyaltyEventType = (typeof BANANO_LOYALTY_EVENT_TYPES_ALL)[number];
