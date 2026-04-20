/**
 * One-off sync: messages/en.json HomePage was partially French (copy-paste drift).
 * Source of truth for EN marketing copy: messages/en-gb.json HomePage, US-localized.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const enPath = path.join(root, 'messages/en.json');
const enGbPath = path.join(root, 'messages/en-gb.json');

function usLocalizeHomePageStrings(val) {
  if (typeof val === 'string') {
    let s = val;
    s = s.replace(/£0\b/g, '[[PX:zero]]');
    s = s.replace(/\bpersonalised\b/gi, 'personalized');
    s = s.replace(/\bPersonalised\b/g, 'Personalized');
    s = s.replace(/\bfavourable\b/gi, 'favorable');
    s = s.replace(/\bFavourable\b/g, 'Favorable');
    s = s.replace(/\bcolour\b/gi, 'color');
    s = s.replace(/\bColour\b/g, 'Color');
    s = s.replace(/^Analyse my reputation$/i, 'Analyze my reputation');
    return s;
  }
  if (Array.isArray(val)) {
    return val.map((x) => usLocalizeHomePageStrings(x));
  }
  if (val && typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) {
      out[k] = usLocalizeHomePageStrings(val[k]);
    }
    return out;
  }
  return val;
}

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const enGb = JSON.parse(fs.readFileSync(enGbPath, 'utf8'));

if (!enGb.HomePage) {
  console.error('en-gb.json missing HomePage');
  process.exit(1);
}

en.HomePage = usLocalizeHomePageStrings(JSON.parse(JSON.stringify(enGb.HomePage)));

/** Overwrite matching keys from en-gb; keep keys only present in en. */
function mergeFromSource(target, source) {
  for (const k of Object.keys(source)) {
    const sv = source[k];
    const tv = target[k];
    if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
      if (tv && typeof tv === 'object' && !Array.isArray(tv)) {
        mergeFromSource(tv, sv);
      } else {
        target[k] = sv;
      }
    } else {
      target[k] = sv;
    }
  }
}

if (en.Dashboard?.reviewCollection && enGb.Dashboard?.reviewCollection) {
  mergeFromSource(en.Dashboard.reviewCollection, enGb.Dashboard.reviewCollection);
  console.log('Merged Dashboard.reviewCollection key-by-key from en-gb.');
}

fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
console.log('Updated messages/en.json HomePage from en-gb (US-localized).');
