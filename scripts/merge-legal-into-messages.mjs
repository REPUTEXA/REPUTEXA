/**
 * Fusionne locale-partials/legal/{locale}.json → messages/*.json sous la clé Legal
 * en **fusion profonde** : ne supprime pas nav / cgu / confidentialite / mentionsLegales.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function deepMerge(target, source) {
  if (source == null) return target;
  if (Array.isArray(source)) return source.slice();
  if (typeof source !== 'object') return source;
  const out = { ...target };
  for (const k of Object.keys(source)) {
    const sv = source[k];
    const tv = out[k];
    if (sv != null && typeof sv === 'object' && !Array.isArray(sv) && typeof tv === 'object' && tv != null && !Array.isArray(tv)) {
      out[k] = deepMerge(tv, sv);
    } else {
      out[k] = sv;
    }
  }
  return out;
}

function readLegalFromGit(locale) {
  try {
    const raw = execSync(`git show origin/main:messages/${locale}.json`, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });
    const j = JSON.parse(raw);
    return j.Legal && typeof j.Legal === 'object' ? j.Legal : null;
  } catch {
    return null;
  }
}

for (const locale of ['fr', 'en', 'es', 'de', 'it']) {
  const messagesPath = path.join(root, 'messages', `${locale}.json`);
  const legalPath = path.join(root, 'locale-partials', 'legal', `${locale}.json`);
  if (!fs.existsSync(messagesPath)) {
    console.warn('skip messages — missing', messagesPath);
    continue;
  }
  const messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
  const fromGit = readLegalFromGit(locale);
  const partial = fs.existsSync(legalPath) ? JSON.parse(fs.readFileSync(legalPath, 'utf8')) : {};
  const base = fromGit ? deepMerge(fromGit, messages.Legal ?? {}) : { ...(messages.Legal ?? {}) };
  messages.Legal = deepMerge(base, partial);
  fs.writeFileSync(messagesPath, JSON.stringify(messages));
  console.log('merged Legal (deep) →', locale, '| keys:', Object.keys(messages.Legal).join(', '));
}
