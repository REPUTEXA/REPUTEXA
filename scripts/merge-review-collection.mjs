/**
 * Merges locale-partials/reviewCollection/{locale}.json into messages/{locale}.json
 * under Dashboard.reviewCollection
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const partialDir = path.join(root, 'locale-partials', 'reviewCollection');

for (const locale of ['fr', 'en', 'es', 'de', 'it']) {
  const partialPath = path.join(partialDir, `${locale}.json`);
  if (!fs.existsSync(partialPath)) {
    console.error(`merge-review-collection: missing composed partial ${partialPath}. Run: node scripts/compose-review-collection.mjs ${locale}`);
    process.exit(1);
  }
  const messagesPath = path.join(root, 'messages', `${locale}.json`);
  const all = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
  all.Dashboard.reviewCollection = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
  fs.writeFileSync(messagesPath, JSON.stringify(all));
  console.log('merged', locale);
}
