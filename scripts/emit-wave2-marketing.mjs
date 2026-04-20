/**
 * Writes HelpPage, DocumentationPage, ApiPage JSON chunks from scripts/wave2-data/*
 * Run: node scripts/emit-wave2-marketing.mjs && npm run marketing:merge
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { helpPageFr } from './wave2-data/help-fr.mjs';
import { helpPageEn } from './wave2-data/help-en.mjs';
import { helpPageEs } from './wave2-data/help-es.mjs';
import { helpPageDe } from './wave2-data/help-de.mjs';
import { helpPageIt } from './wave2-data/help-it.mjs';

import { documentationPageFr } from './wave2-data/doc-fr.mjs';
import { documentationPageEn } from './wave2-data/doc-en.mjs';
import { documentationPageEs } from './wave2-data/doc-es.mjs';
import { documentationPageDe } from './wave2-data/doc-de.mjs';
import { documentationPageIt } from './wave2-data/doc-it.mjs';

import { apiPageFr } from './wave2-data/api-fr.mjs';
import { apiPageEn } from './wave2-data/api-en.mjs';
import { apiPageEs } from './wave2-data/api-es.mjs';
import { apiPageDe } from './wave2-data/api-de.mjs';
import { apiPageIt } from './wave2-data/api-it.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'locale-partials', 'marketing');

const bundles = {
  fr: {
    HelpPage: helpPageFr,
    DocumentationPage: documentationPageFr,
    ApiPage: apiPageFr,
  },
  en: {
    HelpPage: helpPageEn,
    DocumentationPage: documentationPageEn,
    ApiPage: apiPageEn,
  },
  es: {
    HelpPage: helpPageEs,
    DocumentationPage: documentationPageEs,
    ApiPage: apiPageEs,
  },
  de: {
    HelpPage: helpPageDe,
    DocumentationPage: documentationPageDe,
    ApiPage: apiPageDe,
  },
  it: {
    HelpPage: helpPageIt,
    DocumentationPage: documentationPageIt,
    ApiPage: apiPageIt,
  },
};

for (const loc of Object.keys(bundles)) {
  const b = bundles[loc];
  fs.writeFileSync(
    path.join(outDir, `HelpPage.${loc}.json`),
    JSON.stringify({ HelpPage: b.HelpPage }, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, `DocumentationPage.${loc}.json`),
    JSON.stringify({ DocumentationPage: b.DocumentationPage }, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, `ApiPage.${loc}.json`),
    JSON.stringify({ ApiPage: b.ApiPage }, null, 2)
  );
}

console.log('wave2 → locale-partials/marketing (Help, Documentation, Api) × 5 locales');
