/**
 * Merge Admin.babelWizard + Admin.sentinel360 into all 8 locale JSON files.
 * Run: node scripts/merge-admin-babel-sentinel-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  BABEL_WIZARD_FR,
  BABEL_WIZARD_EN,
  SENTINEL360_FR,
  SENTINEL360_EN,
} from './data/admin-babel-sentinel-locales.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const LOCALES = {
  fr: { babelWizard: BABEL_WIZARD_FR, sentinel360: SENTINEL360_FR },
  en: { babelWizard: BABEL_WIZARD_EN, sentinel360: SENTINEL360_EN },
  es: { babelWizard: BABEL_WIZARD_EN, sentinel360: SENTINEL360_EN },
  de: { babelWizard: BABEL_WIZARD_EN, sentinel360: SENTINEL360_EN },
  it: { babelWizard: BABEL_WIZARD_EN, sentinel360: SENTINEL360_EN },
  pt: { babelWizard: BABEL_WIZARD_EN, sentinel360: SENTINEL360_EN },
  ja: { babelWizard: BABEL_WIZARD_EN, sentinel360: SENTINEL360_EN },
  zh: { babelWizard: BABEL_WIZARD_EN, sentinel360: SENTINEL360_EN },
};

for (const [loc, data] of Object.entries(LOCALES)) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j.Admin) j.Admin = {};
  j.Admin.babelWizard = data.babelWizard;
  j.Admin.sentinel360 = data.sentinel360;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log('merged babelWizard + sentinel360 →', loc);
}
