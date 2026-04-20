/**
 * Merge locale-partials/auth-flow-patch-{locale}.json into messages/{locale}.json
 * (AuthEmails, ConfirmEmailPage, ResetPasswordPage).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const messagesDir = path.join(root, 'messages');
const partialsDir = path.join(root, 'locale-partials');

for (const loc of ['en', 'fr', 'es', 'de', 'it']) {
  const patchPath = path.join(partialsDir, `auth-flow-patch-${loc}.json`);
  const msgPath = path.join(messagesDir, `${loc}.json`);
  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
  const main = JSON.parse(fs.readFileSync(msgPath, 'utf8'));
  for (const key of Object.keys(patch)) {
    main[key] = patch[key];
  }
  fs.writeFileSync(msgPath, JSON.stringify(main));
}

console.log('merged auth-flow patches into messages/*.json');
