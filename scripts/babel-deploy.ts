/**
 * Applique sur le disque un export wizard ou un JSON messages (même logique que POST /api/admin/babel-apply-changes).
 *
 * Prérequis : BABEL_FILESYSTEM_WRITE_ENABLED=true dans l’environnement (ex. .env.local).
 *
 * Usage :
 *   npx tsx scripts/babel-deploy.ts wizard ./chemin/vers/babel-wizard-backup.json
 *   npx tsx scripts/babel-deploy.ts messages pt ./chemin/vers/messages.json
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import path from 'path';
import { assertFilesystemWriteAllowed } from '../lib/babel/babel-filesystem-policy';
import { applyMessagesJsonToDisk, applyWizardBundleToDisk } from '../lib/babel/apply-wizard-bundle';
import { parseWizardBackupJson } from '../lib/babel/babel-wizard-types';

async function main() {
  assertFilesystemWriteAllowed();
  const [, , mode, a, b] = process.argv;
  const root = process.cwd();

  if (mode === 'wizard' && a) {
    const raw = await readFile(path.resolve(a), 'utf8');
    const parsed = parseWizardBackupJson(raw);
    if (!parsed?.state) {
      console.error('Fichier invalide : attendu export babelWizardBackup avec state.');
      process.exit(1);
    }
    const result = await applyWizardBundleToDisk({ projectRoot: root, state: parsed.state });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  }

  if (mode === 'messages' && a && b) {
    const locale = a.trim().toLowerCase();
    const raw = await readFile(path.resolve(b), 'utf8');
    const json = JSON.parse(raw) as Record<string, unknown>;
    const result = await applyMessagesJsonToDisk({ projectRoot: root, localeCode: locale, messages: json });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.errors.length ? 1 : 0);
  }

  console.error(`Usage:
  npx tsx scripts/babel-deploy.ts wizard <backup.json>
  npx tsx scripts/babel-deploy.ts messages <locale> <messages.json>`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
