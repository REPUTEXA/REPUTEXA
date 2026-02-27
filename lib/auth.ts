import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * Récupère ou crée l'utilisateur Prisma à partir de Clerk
 */
export async function getOrCreateUser() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  const email = (sessionClaims?.email as string) ?? '';

  let user = await prisma.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkUserId: userId,
        email: email || `user-${userId}@placeholder.local`,
      },
    });
  }

  return user;
}
