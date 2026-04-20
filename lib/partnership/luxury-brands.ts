import { getPartnershipLuxuryBrands } from '@/src/lib/empire-settings';

/** Extrait un produit luxe « mission » depuis le metadata d’une touche outreach. */
export function getMissionLuxuryProductFromMetadata(metadata: unknown): string | undefined {
  if (metadata == null || typeof metadata !== 'object') return undefined;
  const m = metadata as Record<string, unknown>;
  const raw = m.missionLuxuryProduct ?? m.luxuryProduct ?? m.missionProduct;
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return t.length ? t : undefined;
}

/**
 * Vérifie que la valeur est exactement l’une des marques listées dans `targets/settings.json`
 * (`partnership.luxury_brands`, casse tolérée ; valeur canonique = entrée du JSON).
 */
export function assertAllowedLuxuryMissionProduct(raw: string): string {
  const allowed = getPartnershipLuxuryBrands();
  const lower = raw.toLowerCase();
  const match = allowed.find((a) => a.toLowerCase() === lower);
  if (!match) {
    throw new Error('LUXURY_MISSION_PRODUCT_NOT_ALLOWED');
  }
  return match;
}
