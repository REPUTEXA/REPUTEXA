import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'messages', 'ja.json'), 'utf8'));

function walkStrings(o, p, out) {
  if (typeof o === 'string') {
    if (!p.startsWith('Api.errors')) out.push(p);
    return;
  }
  if (!o || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    walkStrings(o[k], p ? `${p}.${k}` : k, out);
  }
}

const out = [];
walkStrings(j.Api, 'Api', out);
console.log(out.join('\n'));
