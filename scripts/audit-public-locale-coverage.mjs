/**
 * Liste les pages / écrans sous app/[locale] (hors admin) qui n'importent pas next-intl.
 * Utile pour prioriser l'i18n dashboard + marketing.
 *
 * Usage: node scripts/audit-public-locale-coverage.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localeRoot = path.join(__dirname, '..', 'app', '[locale]');

function walkTsx(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTsx(p, out);
    else if (ent.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function isExcluded(relPath) {
  const r = relPath.split(path.sep).join('/');
  return r.includes('/dashboard/admin/') || r === 'dashboard/admin/page.tsx' || r.startsWith('dashboard/admin/');
}

const all = walkTsx(localeRoot);
const rel = (abs) => path.relative(localeRoot, abs);

const candidates = all.filter((f) => !isExcluded(rel(f)));

const noIntl = candidates.filter((f) => {
  const c = fs.readFileSync(f, 'utf8');
  return (
    !c.includes('useTranslations') &&
    !c.includes('getTranslations') &&
    !c.includes('getFormatter')
  );
});

console.log(`app/[locale] .tsx hors dashboard/admin : ${candidates.length} fichiers`);
console.log(`Sans useTranslations / getTranslations / getFormatter : ${noIntl.length}\n`);
for (const f of noIntl.sort()) {
  console.log(rel(f).split(path.sep).join('/'));
}
