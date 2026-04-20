/**
 * Matérialise TOUTES les clés de messages/fr.json dans chaque messages/{locale}.json
 * pour éviter le repli partiel au runtime (mélange de langues).
 *
 * Priorité par clé feuille : valeur déjà présente et non vide → en.json → fr.json
 * Objets : fusion récursive. Tableaux : conservés si la locale a déjà des éléments, sinon en, sinon fr.
 *
 * Usage : node scripts/sync-all-locale-messages.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, '..', 'messages');

const LOCALES = ['en', 'es', 'de', 'it', 'pt', 'ja', 'zh'];

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isNonEmptyLeaf(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.length > 0;
  if (typeof v === 'number' || typeof v === 'boolean') return true;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * @param {unknown} frNode
 * @param {unknown} enNode
 * @param {unknown} locNode
 */
function deepFill(frNode, enNode, locNode) {
  if (Array.isArray(frNode)) {
    const enArr = Array.isArray(enNode) ? enNode : [];
    const locArr = Array.isArray(locNode) ? locNode : [];
    return frNode.map((frItem, i) => deepFill(frItem, enArr[i], locArr[i]));
  }
  if (!isPlainObject(frNode)) {
    if (isNonEmptyLeaf(locNode)) return locNode;
    if (isNonEmptyLeaf(enNode)) return enNode;
    return frNode;
  }
  const en = isPlainObject(enNode) ? enNode : {};
  const loc = isPlainObject(locNode) ? locNode : {};
  const out = {};
  for (const k of Object.keys(frNode)) {
    out[k] = deepFill(frNode[k], en[k], loc[k]);
  }
  // Ne pas conserver de clés hors arbre fr.json : sinon parité des locales et comptes de clés cassés.
  return out;
}

function loadJson(name) {
  const p = path.join(messagesDir, name);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(name, data) {
  const p = path.join(messagesDir, name);
  fs.writeFileSync(p, JSON.stringify(data));
}

const fr = loadJson('fr.json');
const en = loadJson('en.json');

for (const code of LOCALES) {
  const targetPath = `${code}.json`;
  let current = {};
  try {
    current = loadJson(targetPath);
  } catch {
    console.warn(`Missing ${targetPath}, creating from fr/en`);
  }
  const merged = deepFill(fr, en, current);
  writeJson(targetPath, merged);
  console.log(`Wrote ${targetPath} (keys aligned with fr.json structure)`);
}

console.log('\nsync-all-locale-messages: done. Review: gaps filled from en, then fr — translate remaining EN/FR strings per locale for native UX.');
