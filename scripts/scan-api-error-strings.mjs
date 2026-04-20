import fs from 'fs';
import path from 'path';

const re = /error:\s*['"`]([^'"`]+)['"`]/g;
const out = new Map();

function walk(d) {
  for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, n.name);
    if (n.isDirectory()) walk(p);
    else if (n.name.endsWith('.ts') && !n.name.endsWith('.d.ts')) {
      const t = fs.readFileSync(p, 'utf8');
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(t))) {
        const s = m[1];
        if (s.includes('${')) continue;
        out.set(s, (out.get(s) || 0) + 1);
      }
    }
  }
}

walk('app/api');
const sorted = [...out.entries()].sort((a, b) => b[1] - a[1]);
for (const [k, v] of sorted) console.log(v + '\t' + JSON.stringify(k));
console.error('unique', out.size);
