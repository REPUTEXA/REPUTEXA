/**
 * Heuristiques « client perdu » (jours sans passage) selon le métier wallet.
 * Aligné sur `WALLET_ARCHETYPE_IDS` : pas d’import depuis `archetypes.ts` pour éviter un cycle.
 */
export function recommendedInactivityDaysForTrade(
  archetypeId: string | null | undefined
): number {
  if (!archetypeId) return 35;
  switch (archetypeId) {
    case 'bakery':
    case 'cafe':
      return 25;
    case 'restaurant':
      return 32;
    case 'butcher':
    case 'retail':
    case 'florist':
      return 35;
    case 'hair':
    case 'beauty':
      return 48;
    case 'pharmacy':
    case 'garage':
      return 55;
    case 'fitness':
      return 42;
    case 'hotel':
      return 75;
    default:
      return 35;
  }
}
