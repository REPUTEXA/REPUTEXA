/**
 * Fusionne AuthEmails + EmailTemplates dans messages/fr.json (source de vérité i18n e-mails).
 * Exécuter depuis la racine : node scripts/merge-email-i18n-into-fr.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const frPath = path.join(root, 'messages', 'fr.json');

const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const auth = JSON.parse(fs.readFileSync(path.join(__dirname, 'email-i18n-auth.json'), 'utf8'));
const fragDir = path.join(__dirname, 'email-fragments');
const mergedTemplates = {};
for (const f of fs.readdirSync(fragDir).filter((x) => x.endsWith('.json')).sort()) {
  const chunk = JSON.parse(fs.readFileSync(path.join(fragDir, f), 'utf8'));
  Object.assign(mergedTemplates, chunk);
}

Object.assign(fr, auth);
fr.EmailTemplates = mergedTemplates;

fs.writeFileSync(frPath, JSON.stringify(fr));

console.log('OK: merged AuthEmails + EmailTemplates into messages/fr.json');
