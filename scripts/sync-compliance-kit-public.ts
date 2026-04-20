/**
 * Copie les fichiers du kit conformité depuis docs/ vers public/
 * pour que /docs/compliance-audit-kit/* reste aligné avec la source (liens admin, prod).
 *
 * Exécuté automatiquement avant `next dev` et `next build` (voir package.json).
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'docs', 'compliance-audit-kit');
const DEST_DIR = path.join(ROOT, 'public', 'docs', 'compliance-audit-kit');

const FILES = [
  'README.md',
  'GUIDE-COMPLET-VERIFICATION-CONFORMITE.md',
  'FORTRESSE-QUATRE-PILIERS.md',
  'liste-sous-traitants.csv',
  'emplacements-logs.md',
] as const;

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.warn('[compliance-kit:sync] Dossier source absent, ignoré:', SRC_DIR);
    process.exit(0);
  }

  fs.mkdirSync(DEST_DIR, { recursive: true });

  for (const name of FILES) {
    const src = path.join(SRC_DIR, name);
    const dest = path.join(DEST_DIR, name);
    if (!fs.existsSync(src)) {
      console.warn('[compliance-kit:sync] Fichier absent, ignoré:', name);
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log('[compliance-kit:sync]', name, '→', path.relative(ROOT, dest));
  }
}

main();
