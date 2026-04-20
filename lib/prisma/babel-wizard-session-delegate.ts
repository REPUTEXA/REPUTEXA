import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const WIZARD_HELP =
  'Exécutez « npx prisma generate », appliquez la migration Supabase 167 (babel_language_wizard_sessions), puis redémarrez « npm run dev ». Le client Prisma en mémoire ne voit pas les nouveaux modèles tant que le serveur Next n’a pas été relancé.';

/**
 * Délégation Prisma pour les sessions wizard. Évite l’erreur runtime
 * « Cannot read properties of undefined (reading 'create') » quand le client
 * a été généré avant l’ajout du modèle.
 */
export function getBabelWizardSessionDelegate(): PrismaClient['babelLanguageWizardSession'] {
  const raw = prisma as unknown as Record<string, unknown>;
  const d = raw.babelLanguageWizardSession as PrismaClient['babelLanguageWizardSession'] | undefined;
  if (!d || typeof (d as { create?: unknown }).create !== 'function') {
    throw new Error(`Client Prisma obsolète : ${WIZARD_HELP}`);
  }
  return d;
}

export function isBabelWizardSessionAvailable(): boolean {
  try {
    getBabelWizardSessionDelegate();
    return true;
  } catch {
    return false;
  }
}
