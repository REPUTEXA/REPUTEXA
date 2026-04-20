/**
 * Remonte problem…footer depuis HomePage.demo vers HomePage (ordre comme fr.json).
 * Cas typique : merge/sync a laissé des blocs sous demo → merge FR sur clés manquantes.
 * Usage : node scripts/fix-homepage-demo-nesting.mjs messages/it.json messages/es.json
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const fr = JSON.parse(fs.readFileSync(path.join(root, 'messages', 'fr.json'), 'utf8'));
const FR_HOME_ORDER = Object.keys(fr.HomePage);

const KEYS_AFTER_DEMO = [
  'problem',
  'negativeFilter',
  'socialProof',
  'tunnel',
  'commandCenter',
  'preuve',
  'features',
  'perMonth',
  'pricingTrial',
  'googleFlywheel',
  'pricing',
  'testimonials',
  'faq',
  'contact',
  'cta',
  'footer',
];

function fixFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  const it = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const hp = it.HomePage;
  if (!hp?.demo) {
    console.log('[skip]', filePath, 'no HomePage.demo');
    return;
  }
  const demo = hp.demo;
  const misplaced = KEYS_AFTER_DEMO.filter((k) => {
    if (k === 'preuve') return demo.proof !== undefined || demo.preuve !== undefined;
    return demo[k] !== undefined;
  });
  if (misplaced.length === 0) {
    console.log('[skip]', filePath, 'nothing to hoist');
    return;
  }

  if (demo.proof !== undefined) {
    hp.preuve = demo.proof;
    delete demo.proof;
  }
  if (demo.preuve !== undefined && hp.preuve === undefined) {
    hp.preuve = demo.preuve;
    delete demo.preuve;
  }

  for (const k of KEYS_AFTER_DEMO) {
    if (k === 'preuve') continue;
    if (demo[k] !== undefined) {
      hp[k] = demo[k];
      delete demo[k];
    }
  }

  const newHp = {};
  for (const key of FR_HOME_ORDER) {
    if (hp[key] !== undefined) newHp[key] = hp[key];
  }
  for (const key of Object.keys(hp)) {
    if (!(key in newHp)) newHp[key] = hp[key];
  }
  it.HomePage = newHp;

  fs.writeFileSync(abs, JSON.stringify(it, null, 2) + '\n');
  console.log('[ok]', path.relative(root, abs), 'hoisted', misplaced.join(', '));
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/fix-homepage-demo-nesting.mjs <messages/it.json> …');
  process.exit(1);
}
for (const f of files) fixFile(f);
