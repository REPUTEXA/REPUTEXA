/**
 * @deprecated Les exemples webhook JSON ne passent plus par des chaînes ICU (parse
 * MALFORMED_ARGUMENT / UNCLOSED_TAG). Voir collecte-avis : construction en code +
 * clés webhookPhysicalSampleLastPurchase / webhookEcommerceSampleLastPurchase.
 * Ce script ne modifie plus les messages si les clés webhookExample* sont absentes.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'messages');

const PLACEHOLDERS = ['siteUrl', 'keyPlaceholder', 'comment'];

function escapeIcuJsonString(s) {
  let out = s;
  const tokens = [];
  PLACEHOLDERS.forEach((ph, i) => {
    const token = `@@PH_${i}@@`;
    out = out.replaceAll(`{${ph}}`, token);
  });
  out = out.replaceAll('{', '{{').replaceAll('}', '}}');
  PLACEHOLDERS.forEach((ph, i) => {
    const token = `@@PH_${i}@@`;
    out = out.replaceAll(token, `{${ph}}`);
  });
  return out;
}

const locales = ['fr', 'en', 'de', 'es', 'it', 'pt', 'ja', 'zh'];

for (const loc of locales) {
  const p = path.join(dir, `${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const rc = j.Dashboard?.reviewCollection;
  if (!rc) continue;
  if (typeof rc.webhookExamplePhysical === 'string') {
    rc.webhookExamplePhysical = escapeIcuJsonString(rc.webhookExamplePhysical);
  }
  if (typeof rc.webhookExampleEcommerce === 'string') {
    rc.webhookExampleEcommerce = escapeIcuJsonString(rc.webhookExampleEcommerce);
  }
  fs.writeFileSync(p, JSON.stringify(j));
}
console.log('Escaped webhookExamplePhysical + webhookExampleEcommerce in', locales.join(', '));
