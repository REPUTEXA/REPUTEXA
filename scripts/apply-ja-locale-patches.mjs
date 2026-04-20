/**
 * Applique des corrections de chaînes dans messages/ja.json (chemins à points).
 * Usage : node scripts/apply-ja-locale-patches.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function setPath(obj, pathStr, value) {
  const parts = pathStr.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] === undefined || cur[p] === null) {
      throw new Error(`Missing path segment: ${parts.slice(0, i + 1).join('.')}`);
    }
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (cur[last] === undefined) {
    throw new Error(`Missing key: ${pathStr}`);
  }
  cur[last] = value;
}

const jaPath = path.join(__dirname, '..', 'messages', 'ja.json');
const ja = JSON.parse(fs.readFileSync(jaPath, 'utf8'));

const chunks = [
  './ja-translate-chunks/api-root-and-errors.mjs',
  './ja-translate-chunks/api-elite-footer-pricing-snippets.mjs',
];

let total = 0;
for (const rel of chunks) {
  const mod = await import(pathToFileURL(path.join(__dirname, rel)).href);
  const patches = mod.default ?? mod.patches;
  if (!patches || typeof patches !== 'object') {
    throw new Error(`No patches export in ${rel}`);
  }
  for (const [k, v] of Object.entries(patches)) {
    setPath(ja, k, v);
    total++;
  }
}

fs.writeFileSync(jaPath, `${JSON.stringify(ja, null, 2)}\n`, 'utf8');
console.log(`[apply-ja-locale-patches] Applied ${total} patches to messages/ja.json`);
