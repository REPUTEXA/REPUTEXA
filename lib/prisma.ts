import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Singleton Prisma. En dev, si tu as lancé `prisma generate` alors que Next tournait déjà,
 * redémarre le serveur : l’ancienne instance en mémoire ne voit pas les nouveaux modèles.
 * `npm run dev` exécute `predev` → `prisma generate` avant Next pour limiter le décalage.
 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
