/**
 * Complète messages/{locale}.json avec la structure de messages/fr.json (clés manquantes = texte FR).
 * Usage : npx tsx scripts/sync-messages-from-fr.ts it
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { mergeMessagesDeep } from '../lib/i18n/merge-messages-deep';

const locale = (process.argv[2] ?? 'it').trim().toLowerCase();
const root = process.cwd();
const fr = JSON.parse(readFileSync(path.join(root, 'messages', 'fr.json'), 'utf8')) as Record<string, unknown>;
const loc = JSON.parse(
  readFileSync(path.join(root, 'messages', `${locale}.json`), 'utf8')
) as Record<string, unknown>;
const merged = mergeMessagesDeep(fr, loc);
writeFileSync(path.join(root, 'messages', `${locale}.json`), `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
console.log(
  `[sync-messages-from-fr] ${locale}.json : ${Object.keys(merged).length} clés racine (FR ⊕ locale existante).`
);
