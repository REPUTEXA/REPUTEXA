/**
 * Deep-merge locale-partials/marketing/*.<locale>.json into messages/<locale>.json
 * File pattern: *.en.json → merged into messages/en.json (object root keys = next-intl namespaces).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const chunkDir = path.join(root, 'locale-partials', 'marketing');
const messagesDir = path.join(root, 'messages');
const locales = ['en', 'fr', 'es', 'de', 'it'];

function deepMerge(base, patch) {
  if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out = { ...base };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = out[k];
    if (
      pv != null &&
      typeof pv === 'object' &&
      !Array.isArray(pv) &&
      bv != null &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      out[k] = deepMerge(bv, pv);
    } else {
      out[k] = pv;
    }
  }
  return out;
}

function main() {
  if (!fs.existsSync(chunkDir)) {
    console.warn('no chunk dir', chunkDir);
    process.exit(0);
  }
  const files = fs.readdirSync(chunkDir).filter((f) => f.endsWith('.json'));
  for (const loc of locales) {
    const suffix = `.${loc}.json`;
    const patches = files.filter((f) => f.endsWith(suffix));
    if (patches.length === 0) continue;
    const msgPath = path.join(messagesDir, `${loc}.json`);
    let data = JSON.parse(fs.readFileSync(msgPath, 'utf8'));
    for (const pf of patches.sort()) {
      const patch = JSON.parse(fs.readFileSync(path.join(chunkDir, pf), 'utf8'));
      data = deepMerge(data, patch);
    }
    fs.writeFileSync(msgPath, JSON.stringify(data));
    console.log(loc, '←', patches.length, 'chunk(s)');
  }
}

main();
