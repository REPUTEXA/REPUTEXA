import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const listPath = path.join(__dirname, 'p2-unique-api-files.txt');
const files = fs.readFileSync(listPath, 'utf8').split(/\r?\n/).filter(Boolean);

const re = /\{ error:\s*['"`][^'"`]+['"`]/;
const re2 = /error:\s*['"`][^'"`]{4,}/;

for (const rel of files) {
  const fp = rel.startsWith('D:') ? rel : path.join(root, rel.replace(/^\//, ''));
  const normalized = path.normalize(fp);
  if (!fs.existsSync(normalized)) continue;
  const txt = fs.readFileSync(normalized, 'utf8');
  const lines = txt.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes('apiAdminT') && line.includes("//")) return;
    if (re.test(line) || (re2.test(line) && line.includes('error:'))) {
      // skip if uses ta( t( apiJsonError
      if (/ta\(|t\(|apiJsonError|apiMerchantAiJsonError|createServerTranslator/.test(line)) return;
      if (/error:\s*ta\(/.test(line)) return;
      if (/error:\s*t\(/.test(line)) return;
      if (/error:\s*tApi\(/.test(line)) return;
      if (/error:\s*e\.message/.test(line)) return;
      if (/error:\s*err/.test(line)) return;
      if (/error:\s*json/.test(line)) return;
      if (/error:\s*`/.test(line) && line.includes('${')) return; // template may be i18n next
      console.log(`${normalized}:${i + 1}:${line.trim().slice(0, 140)}`);
    }
  });
}
