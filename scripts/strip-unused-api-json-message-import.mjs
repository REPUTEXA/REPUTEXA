import fs from 'fs';
import path from 'path';

function walk(dir) {
  for (const n of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, n.name);
    if (n.isDirectory()) walk(p);
    else if (n.name.endsWith('.ts')) {
      let s = fs.readFileSync(p, 'utf8');
      if (!s.includes('apiJsonMessage')) continue;
      if (s.includes('apiJsonMessage(')) continue;
      const o = s;
      s = s.replace(
        /import \{ apiJsonError, apiJsonMessage \} from '@\/lib\/api\/api-error-response';/g,
        "import { apiJsonError } from '@/lib/api/api-error-response';"
      );
      if (s !== o) fs.writeFileSync(p, s);
    }
  }
}

walk(path.join(process.cwd(), 'app', 'api'));
