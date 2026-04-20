/**
 * Merge Dashboard.legalPublish into all 8 locale JSON files.
 * Run: node scripts/merge-dashboard-legal-publish.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LEGAL_PUBLISH_FR, LEGAL_PUBLISH_EN } from './data/dashboard-legal-publish-locales.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const LOCALES = {
  fr: LEGAL_PUBLISH_FR,
  en: LEGAL_PUBLISH_EN,
  es: LEGAL_PUBLISH_EN,
  de: LEGAL_PUBLISH_EN,
  it: LEGAL_PUBLISH_EN,
  pt: LEGAL_PUBLISH_EN,
  ja: LEGAL_PUBLISH_EN,
  zh: LEGAL_PUBLISH_EN,
};

for (const [loc, data] of Object.entries(LOCALES)) {
  const p = path.join(root, 'messages', `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!j.Dashboard) j.Dashboard = {};
  j.Dashboard.legalPublish = data;
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log('merged legalPublish →', loc);
}
