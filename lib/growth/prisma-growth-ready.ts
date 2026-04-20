import { prisma } from '@/lib/prisma';

/**
 * Vrai seulement après `npx prisma generate` (schéma avec growth / outreach).
 * Si false : le serveur tourne souvent avec un vieux client Prisma en cache (globalThis) —
 * arrêter `npm run dev`, puis régénérer (sinon EPERM sur query_engine-windows.dll.node).
 */
export function isGrowthSchemaAvailable(): boolean {
  const p = prisma as unknown as {
    growthCountryConfig?: { findMany?: unknown; upsert?: unknown };
    outreachDomain?: { findMany?: unknown; create?: unknown };
    outreachTouch?: { findMany?: unknown; create?: unknown; createMany?: unknown };
  };
  return (
    typeof p.growthCountryConfig?.findMany === 'function' &&
    typeof p.growthCountryConfig?.upsert === 'function' &&
    typeof p.outreachDomain?.findMany === 'function' &&
    typeof p.outreachTouch?.findMany === 'function'
  );
}

export const GROWTH_PRISMA_STALE_MESSAGE =
  'Client Prisma obsolète : arrêtez le serveur de dev, exécutez « npx prisma generate », relancez le dev. (Sous Windows, EPERM sur query_engine = fichier verrouillé tant que Next tourne.)';
