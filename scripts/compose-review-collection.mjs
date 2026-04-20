/**
 * Composes locale-partials/reviewCollection/{locale}/*.json into a single {locale}.json
 * Usage: node scripts/compose-review-collection.mjs fr
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const locale = process.argv[2];
if (!locale) {
  console.error('Usage: node scripts/compose-review-collection.mjs <locale>');
  process.exit(1);
}
const dir = path.join(root, 'locale-partials', 'reviewCollection', locale);
const parts = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
if (!parts.length) {
  console.error('No partials in', dir);
  process.exit(1);
}
const merged = {};
for (const f of parts) {
  const chunk = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  Object.assign(merged, chunk);
}
const out = path.join(root, 'locale-partials', 'reviewCollection', `${locale}.json`);
fs.writeFileSync(out, JSON.stringify(merged));
console.log('wrote', out, 'from', parts.length, 'parts');
