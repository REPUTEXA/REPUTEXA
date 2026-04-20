/**
 * Complète tous les messages/{locale}.json (sauf fr) avec la structure de fr.json
 * (merge profond : clés manquantes héritées du FR).
 * Usage : npx tsx scripts/sync-all-messages-from-fr.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { mergeMessagesDeep } from '../lib/i18n/merge-messages-deep';
import { SITE_LOCALE_CODES } from '../lib/i18n/site-locales-catalog';

const root = process.cwd();
const fr = JSON.parse(readFileSync(path.join(root, 'messages', 'fr.json'), 'utf8')) as Record<string, unknown>;

for (const locale of SITE_LOCALE_CODES) {
  if (locale === 'fr') continue;
  const p = path.join(root, 'messages', `${locale}.json`);
  const loc = JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
  const merged = mergeMessagesDeep(fr, loc);
  writeFileSync(p, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  console.log(`[sync-all] ${locale}.json → ${Object.keys(merged).length} racines`);
}
