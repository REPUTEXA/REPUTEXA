import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csv = fs.readFileSync(path.join(__dirname, 'client-facing-priority2-api-errors.csv'), 'utf8');
const lines = csv.split(/\r?\n/).slice(1).filter(Boolean);
const set = new Set();
for (const line of lines) {
  const m = line.match(/^"([^"]+)"/);
  if (m) set.add(m[1].replace(/\\/g, '/'));
}
const out = [...set].sort().join('\n');
fs.writeFileSync(path.join(__dirname, 'p2-unique-api-files.txt'), out);
console.log(set.size, 'unique files');
