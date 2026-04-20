/**
 * Écriture disque depuis l’API Next : uniquement environnement contrôlé (jamais sur Vercel par défaut).
 *
 * Définir explicitement :
 *   BABEL_FILESYSTEM_WRITE_ENABLED=true
 *
 * Commit git (API / Overlord) :
 *   BABEL_GIT_COMMIT_ENABLED=true
 *
 * Sur Vercel, le filesystem du déploiement n’est pas modifiable de toute façon ; on bloque quand même
 * pour éviter une fausse impression de succès.
 */
export function getFilesystemWriteBlockReason(): string | null {
  if (process.env.VERCEL === '1') {
    return 'Écriture disque désactivée sur Vercel (filesystem non persistant). Utilisez npm run dev en local ou un serveur Node avec le dépôt monté en RW.';
  }
  if (process.env.BABEL_FILESYSTEM_WRITE_ENABLED !== 'true') {
    return 'Définissez BABEL_FILESYSTEM_WRITE_ENABLED=true dans .env.local (serveur local / staging avec dépôt RW).';
  }
  return null;
}

export function assertFilesystemWriteAllowed(): void {
  const r = getFilesystemWriteBlockReason();
  if (r) throw new Error(r);
}
