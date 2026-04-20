import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const locales = ['fr', 'en', 'de', 'es', 'it', 'pt', 'ja', 'zh'];

for (const loc of locales) {
  const fp = path.join(root, 'messages', `${loc}.json`);
  const patchPath = path.join(root, 'scripts', 'lot4', `adminSecurityPerfection.${loc}.json`);
  if (!fs.existsSync(patchPath)) {
    console.error('missing', patchPath);
    process.exit(1);
  }
  const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
  j.Dashboard.adminSecurityPerfection = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
  fs.writeFileSync(fp, JSON.stringify(j, null, 2) + '\n', 'utf8');
  console.log('merged security', loc);
}
