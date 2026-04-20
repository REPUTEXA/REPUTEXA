/**
 * Fusionne locale-partials/homepage-demo-ui-*.json + presets dans messages/*.json (es, de, it).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function mergeDemo(locale) {
  const uiPath = path.join(root, 'locale-partials', `homepage-demo-ui-${locale}.json`);
  const presetsPath = path.join(root, 'locale-partials', `homepage-demo-presets-${locale}.json`);
  const messagesPath = path.join(root, 'messages', `${locale}.json`);
  const enPath = path.join(root, 'messages', 'en.json');
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const baseDemo = JSON.parse(JSON.stringify(en.HomePage.demo));
  const ui = JSON.parse(fs.readFileSync(uiPath, 'utf8'));
  const presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
  const demo = {
    ...baseDemo,
    ...ui,
    reviewPresets: presets.reviewPresets,
    examples: presets.examples,
  };
  const j = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
  j.HomePage = j.HomePage || {};
  j.HomePage.demo = demo;
  fs.writeFileSync(messagesPath, JSON.stringify(j));
  console.log('merged HomePage.demo →', locale);
}

for (const loc of ['es', 'de', 'it']) {
  mergeDemo(loc);
}
