/**
 * If messages/en.json Dashboard strings still match messages/fr.json (locale drift),
 * replace them from messages/en-gb.json when GB has a different value.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function walkLeaves(obj, prefix, out) {
  if (obj == null) return;
  if (typeof obj === 'string') {
    out.push([prefix, obj]);
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walkLeaves(v, `${prefix}[${i}]`, out));
    return;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      walkLeaves(obj[k], p, out);
    }
  }
}

function getAt(rootObj, dotPath) {
  const parts = dotPath.split('.');
  let o = rootObj;
  for (const part of parts) {
    const m = /^([^\[]+)\[(\d+)\]$/.exec(part);
    if (m) {
      o = o?.[m[1]]?.[Number(m[2])];
    } else {
      o = o?.[part];
    }
  }
  return o;
}

function setAt(rootObj, dotPath, value) {
  const parts = dotPath.split('.');
  let o = rootObj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const m = /^([^\[]+)\[(\d+)\]$/.exec(part);
    if (m) {
      const key = m[1];
      const idx = Number(m[2]);
      if (!o[key]) o[key] = [];
      o = o[key][idx];
    } else {
      if (!o[part]) o[part] = {};
      o = o[part];
    }
  }
  const last = parts[parts.length - 1];
  const lm = /^([^\[]+)\[(\d+)\]$/.exec(last);
  if (lm) {
    const key = lm[1];
    const idx = Number(lm[2]);
    if (!o[key]) o[key] = [];
    o[key][idx] = value;
  } else {
    o[last] = value;
  }
}

const enPath = path.join(root, 'messages/en.json');
const frPath = path.join(root, 'messages/fr.json');
const gbPath = path.join(root, 'messages/en-gb.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const gb = JSON.parse(fs.readFileSync(gbPath, 'utf8'));

const leaves = [];
walkLeaves(en.Dashboard, '', leaves);

let replaced = 0;
let skippedNoGb = 0;
const samples = [];

for (const [rel, ev] of leaves) {
  if (typeof ev !== 'string') continue;
  const frv = getAt(fr.Dashboard, rel);
  const gbv = getAt(gb.Dashboard, rel);
  if (frv !== ev) continue; // not French drift
  if (typeof gbv !== 'string') {
    skippedNoGb++;
    if (samples.length < 40) samples.push(rel);
    continue;
  }
  if (gbv === ev) continue;
  setAt(en.Dashboard, rel, gbv);
  replaced++;
}

fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n');

console.log(`Replaced ${replaced} Dashboard strings from en-gb (en matched fr).`);
console.log(`Skipped (en===fr but no GB string): ${skippedNoGb}`);
if (samples.length) {
  console.log('Sample paths still needing manual EN (no GB or GB same as FR):');
  samples.forEach((s) => console.log('  ', s));
}
