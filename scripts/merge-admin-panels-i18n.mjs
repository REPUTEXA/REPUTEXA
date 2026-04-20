/**
 * Merge Admin.complianceSentinel, Admin.codeGuardian, Admin.growthEquirectMap into all 8 locale JSON files.
 * Run: node scripts/merge-admin-panels-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ADMIN_PANELS_FR, ADMIN_PANELS_EN } from './data/admin-panels-locales.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const LOCALES = {
  fr: ADMIN_PANELS_FR,
  en: ADMIN_PANELS_EN,
  es: ADMIN_PANELS_EN,
  de: ADMIN_PANELS_EN,
  it: ADMIN_PANELS_EN,
  pt: ADMIN_PANELS_EN,
  ja: ADMIN_PANELS_EN,
  zh: ADMIN_PANELS_EN,
};

for (const [loc, data] of Object.entries(LOCALES)) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j.Admin) j.Admin = {};
  j.Admin.complianceSentinel = data.complianceSentinel;
  j.Admin.codeGuardian = data.codeGuardian;
  j.Admin.growthEquirectMap = data.growthEquirectMap;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log('merged Admin panels →', loc);
}
